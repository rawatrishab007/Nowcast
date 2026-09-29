"""
WeatherNow AI — Real Himawari + GFS Spatiotemporal Alignment Pipeline (Phase 1C)
Combines real Himawari-9 AHI Band 13 observations and operational NOAA GFS 0.25° NWP
fields into a physically calibrated, spatiotemporally aligned sequence tensor of shape (6, 8, 128, 128) float32.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np

from config import settings
from .base import DataProviderError, DataValidationError
from .himawari import HimawariDownloader, HimawariUnavailableError
from .gfs import GFSDownloader, GFSUnavailableError
from .spatial import (
    LAT_MIN,
    LAT_MAX,
    LON_MIN,
    LON_MAX,
    TARGET_HEIGHT,
    TARGET_WIDTH,
)

logger = logging.getLogger("weathernow.data_providers.alignment")

# Strict Frozen Channel Specification
CHANNEL_NAMES = ["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]
NUM_CHANNELS = 8
NUM_FRAMES = 6

# Physical validation bounds (unnormalized physical units)
PHYSICAL_BOUNDS = {
    "B13": (140.0, 360.0),      # Brightness Temperature in Kelvin
    "t2m": (-60.0, 65.0),       # 2m Temperature in °C
    "d2m": (-70.0, 50.0),       # 2m Dewpoint in °C
    "u10": (-120.0, 120.0),     # 10m U-wind in m/s
    "v10": (-120.0, 120.0),     # 10m V-wind in m/s
    "cape": (0.0, 12000.0),     # Surface CAPE in J/kg
    "cin": (0.0, 2500.0),       # Surface CIN in J/kg
    "tp": (0.0, 2.0),           # Total Precipitation in meters
}


class TemporalAlignmentError(DataProviderError):
    """Raised when temporal alignment between satellite scans and NWP forecasts fails."""
    pass


class SpatiotemporalAligner:
    """
    Spatiotemporal Alignment Layer for Himawari-9 Satellite and NOAA GFS NWP data.
    Aligns 6 consecutive 10-minute satellite scans with temporally interpolated GFS fields.
    """

    def __init__(
        self,
        himawari_downloader: Optional[HimawariDownloader] = None,
        gfs_downloader: Optional[GFSDownloader] = None,
    ):
        self.himawari_downloader = himawari_downloader or HimawariDownloader()
        self.gfs_downloader = gfs_downloader or GFSDownloader()

    @staticmethod
    def parse_iso_datetime(dt_val: Union[str, datetime]) -> datetime:
        """Helper to parse ISO-formatted datetime string or ensure tz-aware UTC datetime."""
        if isinstance(dt_val, str):
            dt = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
        else:
            dt = dt_val
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    @classmethod
    def interpolate_gfs_fields(
        cls,
        target_time: datetime,
        gfs_snapshots: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, np.ndarray], Dict[str, Any]]:
        """
        Linearly interpolates 7 GFS atmospheric fields at target_time from bracketing GFS forecast snapshots.
        Requires snapshots to contain at least two time steps bracketing target_time, or an exact match.
        """
        if not gfs_snapshots:
            raise TemporalAlignmentError("Cannot interpolate GFS fields: empty snapshot list provided.")

        target_dt = cls.parse_iso_datetime(target_time)

        # Parse valid times from GFS snapshots
        parsed_snapshots = []
        for s in gfs_snapshots:
            v_time_str = s.get("metadata", {}).get("forecast_valid_time") or s.get("valid_time")
            if not v_time_str:
                raise DataValidationError("GFS snapshot is missing valid_time metadata.")
            v_dt = cls.parse_iso_datetime(v_time_str)
            parsed_snapshots.append((v_dt, s))

        # Sort by valid time ascending
        parsed_snapshots.sort(key=lambda x: x[0])

        times = [p[0] for p in parsed_snapshots]
        min_time = times[0]
        max_time = times[-1]

        # Check bounds (allowing a tiny tolerance of 1 second)
        if target_dt < min_time - timedelta(seconds=1) or target_dt > max_time + timedelta(seconds=1):
            raise TemporalAlignmentError(
                f"Target observation time {target_dt.isoformat()} is outside available GFS time window "
                f"[{min_time.isoformat()}, {max_time.isoformat()}]."
            )

        # Exact match check
        for v_dt, s in parsed_snapshots:
            if abs((v_dt - target_dt).total_seconds()) < 1.0:
                fields = {
                    var: np.array(s[var], dtype=np.float32)
                    for var in ["t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]
                }
                meta = {
                    "interpolation_type": "exact_match",
                    "t0": v_dt.isoformat(),
                    "t1": v_dt.isoformat(),
                    "alpha": 0.0,
                }
                return fields, meta

        # Find bracketing pair t0 <= target_dt <= t1
        t0_snap = None
        t1_snap = None
        for i in range(len(parsed_snapshots) - 1):
            s0_dt, s0 = parsed_snapshots[i]
            s1_dt, s1 = parsed_snapshots[i + 1]
            if s0_dt <= target_dt <= s1_dt:
                t0_dt, t0_snap = s0_dt, s0
                t1_dt, t1_snap = s1_dt, s1
                break

        if t0_snap is None or t1_snap is None:
            raise TemporalAlignmentError(
                f"Could not find valid bracketing GFS forecast steps for time {target_dt.isoformat()}."
            )

        total_duration = (t1_dt - t0_dt).total_seconds()
        if total_duration <= 0:
            alpha = 0.0
        else:
            alpha = (target_dt - t0_dt).total_seconds() / total_duration

        interpolated = {}
        for var in ["t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]:
            arr0 = np.array(t0_snap[var], dtype=np.float32)
            arr1 = np.array(t1_snap[var], dtype=np.float32)
            if arr0.shape != (TARGET_HEIGHT, TARGET_WIDTH) or arr1.shape != (TARGET_HEIGHT, TARGET_WIDTH):
                raise DataValidationError(f"Invalid GFS grid shape for variable '{var}'.")
            
            interp_arr = (1.0 - alpha) * arr0 + alpha * arr1
            interpolated[var] = interp_arr.astype(np.float32)

        meta = {
            "interpolation_type": "linear",
            "t0": t0_dt.isoformat(),
            "t1": t1_dt.isoformat(),
            "alpha": float(alpha),
        }
        return interpolated, meta

    @classmethod
    def align_sequence(
        cls,
        himawari_frames: List[Dict[str, Any]],
        gfs_snapshots: List[Dict[str, Any]],
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Combines 6 Himawari observations and GFS snapshots into an unnormalized (6, 8, 128, 128) array.
        
        Args:
            himawari_frames: List of 6 Himawari observation dictionaries (ordered chronological t-50m to t).
            gfs_snapshots: List of GFS snapshot dictionaries covering the observation span.

        Returns:
            Tuple of:
              - aligned_tensor: np.ndarray with shape (6, 8, 128, 128) and dtype float32.
              - provenance: Dict with complete spatiotemporal lineage metadata.
        """
        if len(himawari_frames) != NUM_FRAMES:
            raise DataValidationError(
                f"Expected {NUM_FRAMES} Himawari frames, but received {len(himawari_frames)}."
            )

        tensor = np.zeros((NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH), dtype=np.float32)
        frame_metadata = []

        for f_idx, h_frame in enumerate(himawari_frames):
            obs_time_str = h_frame.get("timestamp")
            if not obs_time_str:
                raise DataValidationError(f"Himawari frame {f_idx} missing 'timestamp'.")
            obs_time = cls.parse_iso_datetime(obs_time_str)

            # 1. Himawari B13 (Channel 0) - NEVER temporally interpolated
            b13_grid = np.array(h_frame["grid"], dtype=np.float32)
            if b13_grid.shape != (TARGET_HEIGHT, TARGET_WIDTH):
                raise DataValidationError(
                    f"Himawari B13 grid shape {b13_grid.shape} mismatch. Expected ({TARGET_HEIGHT}, {TARGET_WIDTH})."
                )
            tensor[f_idx, 0, :, :] = b13_grid

            # 2. GFS 7 Atmospheric variables (Channels 1 to 7) - Linearly interpolated to scan timestamp
            gfs_interp, interp_meta = cls.interpolate_gfs_fields(obs_time, gfs_snapshots)

            tensor[f_idx, 1, :, :] = gfs_interp["t2m"]
            tensor[f_idx, 2, :, :] = gfs_interp["d2m"]
            tensor[f_idx, 3, :, :] = gfs_interp["u10"]
            tensor[f_idx, 4, :, :] = gfs_interp["v10"]
            tensor[f_idx, 5, :, :] = gfs_interp["cape"]
            tensor[f_idx, 6, :, :] = gfs_interp["cin"]
            tensor[f_idx, 7, :, :] = gfs_interp["tp"]

            frame_metadata.append({
                "frame_index": f_idx,
                "target_timestamp": obs_time.isoformat(),
                "himawari_source": h_frame.get("source", "Real Himawari-9 AHI Band 13"),
                "gfs_interpolation": interp_meta,
            })

        # 3. Comprehensive Numerical & Physical Range Validation
        if np.isnan(tensor).any():
            raise DataValidationError("Aligned tensor contains NaN values.")
        if np.isinf(tensor).any():
            raise DataValidationError("Aligned tensor contains Infinite values.")

        channel_diagnostics = {}
        for c_idx, ch_name in enumerate(CHANNEL_NAMES):
            ch_data = tensor[:, c_idx, :, :]
            ch_min = float(np.min(ch_data))
            ch_max = float(np.max(ch_data))
            ch_mean = float(np.mean(ch_data))
            ch_std = float(np.std(ch_data))

            valid_min, valid_max = PHYSICAL_BOUNDS[ch_name]
            if ch_min < valid_min or ch_max > valid_max:
                logger.warning(
                    f"Channel {c_idx} ({ch_name}) physical range alert: "
                    f"[{ch_min:.3f}, {ch_max:.3f}] outside nominal [{valid_min}, {valid_max}]."
                )

            channel_diagnostics[ch_name] = {
                "channel_index": c_idx,
                "min": ch_min,
                "max": ch_max,
                "mean": ch_mean,
                "std": ch_std,
            }

        provenance = {
            "tensor_shape": list(tensor.shape),
            "dtype": str(tensor.dtype),
            "channel_order": CHANNEL_NAMES,
            "grid_dimensions": {
                "height": TARGET_HEIGHT,
                "width": TARGET_WIDTH,
                "lat_min": LAT_MIN,
                "lat_max": LAT_MAX,
                "lon_min": LON_MIN,
                "lon_max": LON_MAX,
                "row_0_latitude": LAT_MAX,
                "row_127_latitude": LAT_MIN,
                "col_0_longitude": LON_MIN,
                "col_127_longitude": LON_MAX,
            },
            "synthetic_data_used": False,
            "frames": frame_metadata,
            "channel_statistics": channel_diagnostics,
        }

        return tensor, provenance

    def fetch_and_align(self, target_time: Optional[datetime] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Orchestrates full live retrieval and spatiotemporal alignment:
        1. Retrieves 6 consecutive Himawari-9 B13 satellite scans (t-50m to t).
        2. Retrieves operational GFS forecast steps covering the time window.
        3. Aligns and packages the (6, 8, 128, 128) float32 tensor.
        """
        ref_time = target_time or datetime.now(timezone.utc)
        logger.info(f"Initiating real Himawari + GFS alignment pipeline for reference time {ref_time.isoformat()}")

        # 1. Ingest 6 real Himawari observations
        himawari_frames = self.himawari_downloader.fetch_b13_sequence(target_time, count=NUM_FRAMES)
        if len(himawari_frames) != NUM_FRAMES:
            raise HimawariUnavailableError(f"Could not retrieve {NUM_FRAMES} Himawari frames.")

        earliest_time = self.parse_iso_datetime(himawari_frames[0]["timestamp"])
        latest_time = self.parse_iso_datetime(himawari_frames[-1]["timestamp"])

        # 2. Ingest GFS hourly snapshots covering [earliest_time - 1h, latest_time + 1h]
        # Calculate hourly steps needed
        gfs_start_hour = earliest_time.replace(minute=0, second=0, microsecond=0)
        gfs_end_hour = (latest_time + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)

        gfs_snapshots = []
        curr_hour = gfs_start_hour
        while curr_hour <= gfs_end_hour:
            gfs_snap = self.gfs_downloader.fetch_gfs_observation(curr_hour)
            # Ensure snapshot metadata contains forecast_valid_time
            if "metadata" not in gfs_snap:
                gfs_snap["metadata"] = {}
            if "forecast_valid_time" not in gfs_snap["metadata"]:
                gfs_snap["metadata"]["forecast_valid_time"] = curr_hour.isoformat()
            gfs_snapshots.append(gfs_snap)
            curr_hour += timedelta(hours=1)

        # 3. Spatiotemporally align the sequence
        return self.align_sequence(himawari_frames, gfs_snapshots)
