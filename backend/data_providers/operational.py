"""
WeatherNow AI — Real Operational Atmospheric Data Provider & Live Prediction Service (Phase 1E)
Integrates real Himawari-9 B13 satellite scans, operational NOAA GFS NWP fields,
Phase 1C spatiotemporal alignment, Phase 1D frozen V3 normalization, and frozen SIHV3Nowcast inference.
STRICT RULE: Zero synthetic substitution in live operational mode.
"""

import time
import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import torch

from config import settings
from model_loader import model_manager, SIHV3Nowcast
from schemas import PredictResponse, HorizonMap, UnifiedNowcastResponse
from inference import run_unified_nowcast_inference
from .base import BaseDataProvider, DataProviderError, DataValidationError
from .himawari import HimawariDownloader, HimawariUnavailableError
from .gfs import GFSDownloader, GFSUnavailableError
from .alignment import (
    SpatiotemporalAligner,
    TemporalAlignmentError,
    CHANNEL_NAMES,
    NUM_CHANNELS,
    NUM_FRAMES
)
from .v3_preprocessing import (
    normalize_for_v3,
    construct_v3_input_tensor,
    verify_physical_units_and_ranges,
)
from .spatial import TARGET_HEIGHT, TARGET_WIDTH

logger = logging.getLogger("weathernow.data_providers.operational")


class LivePredictionService:
    """
    Orchestrates real operational ingestion, spatiotemporal alignment,
    frozen V3 normalization, and model inference for /api/predict/live.
    """

    def __init__(
        self,
        aligner: Optional[SpatiotemporalAligner] = None,
        cache_ttl_seconds: float = 300.0
    ):
        self.aligner = aligner or SpatiotemporalAligner()
        self.cache_ttl_seconds = cache_ttl_seconds
        self._lock = threading.Lock()
        self._last_prediction: Optional[PredictResponse] = None
        self._last_base_time: Optional[str] = None
        self._last_calc_time: float = 0.0
        self._last_unified_prediction: Optional[UnifiedNowcastResponse] = None
        self._last_unified_base_time: Optional[str] = None
        self._last_unified_calc_time: float = 0.0

    def predict_live(self, target_time: Optional[datetime] = None) -> PredictResponse:
        """
        Executes the complete live operational pipeline:
          1. Ingests 6 real Himawari-9 B13 observations (t-50m to t).
          2. Ingests operational NOAA GFS 0.25° NWP forecast brackets.
          3. Spatiotemporally aligns into (6, 8, 128, 128) physical float32 tensor.
          4. Normalizes via frozen V3 statistics (x - MEAN) / STD.
          5. Constructs (1, 6, 8, 128, 128) model input tensor.
          6. Executes frozen SIHV3Nowcast in evaluation mode.
          7. Applies sigmoid -> 4 probability maps for +30, +60, +90, +120 min.
          8. Returns PredictResponse with full traceability and provenance.
        """
        with self._lock:
            t_start = time.perf_counter()

            # 1. Model Availability Check
            if not model_manager.is_loaded():
                model_loaded = model_manager.load_model()
                if not model_loaded or not model_manager.is_loaded():
                    raise DataProviderError("MODEL_UNAVAILABLE: SIHV3Nowcast weights could not be loaded on server.")

            model = model_manager.get_model()
            device = model_manager.get_device()

            # 2. Acquire & Align Real Operational Observations
            t_acq_start = time.perf_counter()
            try:
                physical_tensor, provenance = self.aligner.fetch_and_align(target_time)
            except HimawariUnavailableError as hue:
                logger.error(f"Live Himawari acquisition failed: {hue}")
                raise DataProviderError(f"HIMAWARI_DATA_UNAVAILABLE: {str(hue)}") from hue
            except GFSUnavailableError as gue:
                logger.error(f"Live GFS acquisition failed: {gue}")
                raise DataProviderError(f"GFS_DATA_UNAVAILABLE: {str(gue)}") from gue
            except TemporalAlignmentError as tae:
                logger.error(f"Live temporal alignment failed: {tae}")
                raise DataProviderError(f"TEMPORAL_ALIGNMENT_FAILED: {str(tae)}") from tae
            except DataValidationError as dve:
                logger.error(f"Live input validation failed: {dve}")
                raise DataProviderError(f"INVALID_V3_INPUT: {str(dve)}") from dve
            except Exception as e:
                logger.error(f"Unexpected operational pipeline failure: {e}")
                raise DataProviderError(f"OPERATIONAL_PIPELINE_ERROR: {str(e)}") from e

            t_acq_end = time.perf_counter()

            # 3. Base Time & Prediction Horizon Timestamps
            # Base time t0 is the actual observation timestamp of the latest Himawari frame (Frame 5)
            latest_frame_meta = provenance["frames"][-1]
            base_time_str = latest_frame_meta["target_timestamp"]
            base_dt = datetime.fromisoformat(base_time_str.replace("Z", "+00:00"))

            # Check prediction cache (reuse prediction if base_time is identical and TTL has not expired)
            curr_time = time.time()
            if (
                self._last_prediction is not None
                and self._last_base_time == base_time_str
                and (curr_time - self._last_calc_time) < self.cache_ttl_seconds
            ):
                logger.info(f"Serving cached live prediction for base_time: {base_time_str}")
                return self._last_prediction

            target_times = {
                "30": (base_dt + timedelta(minutes=30)).isoformat(),
                "60": (base_dt + timedelta(minutes=60)).isoformat(),
                "90": (base_dt + timedelta(minutes=90)).isoformat(),
                "120": (base_dt + timedelta(minutes=120)).isoformat(),
            }

            # 4. Preprocessing & Normalization
            t_norm_start = time.perf_counter()
            normalized_np = normalize_for_v3(physical_tensor)
            model_input = construct_v3_input_tensor(physical_tensor, device=device)
            t_norm_end = time.perf_counter()

            # 5. Model Inference under torch.no_grad()
            t_infer_start = time.perf_counter()
            model.eval()
            with torch.no_grad():
                raw_logits = model(model_input)
                probabilities = torch.sigmoid(raw_logits)
            t_infer_end = time.perf_counter()

            t_total = time.perf_counter() - t_start

            # 6. Post-processing & Output Structuring
            prob_np = probabilities.squeeze(0).cpu().numpy().astype(np.float32)

            horizons_dict: Dict[str, HorizonMap] = {}
            for idx, horizon_min in enumerate(settings.FORECAST_HORIZONS):
                horizon_key = str(horizon_min)
                grid_slice = prob_np[idx]
                grid_2d = grid_slice.tolist()
                horizons_dict[horizon_key] = HorizonMap(
                    horizon_minutes=horizon_min,
                    target_time=target_times.get(horizon_key),
                    unit="probability",
                    height=TARGET_HEIGHT,
                    width=TARGET_WIDTH,
                    map=grid_2d,
                    mean=round(float(np.mean(grid_slice)), 4),
                    max=round(float(np.max(grid_slice)), 4),
                    min=round(float(np.min(grid_slice)), 4)
                )

            # 7. Record Execution Diagnostics, Atmospheric Observations, and Provenance
            latest_frame = physical_tensor[-1]  # shape (8, 128, 128)
            b13_grid = latest_frame[0]
            t2m_grid = latest_frame[1]
            d2m_grid = latest_frame[2]
            u10_grid = latest_frame[3]
            v10_grid = latest_frame[4]
            cape_grid = latest_frame[5]
            cin_grid = latest_frame[6]
            tp_grid = latest_frame[7]

            wind_speed_grid = np.sqrt(u10_grid**2 + v10_grid**2) * 3.6  # km/h
            tp_mm_grid = tp_grid * 1000.0  # mm

            atmospheric_observations = {
                "domain_summary": {
                    "t2m_c": {"mean": round(float(np.mean(t2m_grid)), 1), "min": round(float(np.min(t2m_grid)), 1), "max": round(float(np.max(t2m_grid)), 1)},
                    "d2m_c": {"mean": round(float(np.mean(d2m_grid)), 1), "min": round(float(np.min(d2m_grid)), 1), "max": round(float(np.max(d2m_grid)), 1)},
                    "wind_speed_kmh": {"mean": round(float(np.mean(wind_speed_grid)), 1), "max": round(float(np.max(wind_speed_grid)), 1)},
                    "precipitation_mm": {"mean": round(float(np.mean(tp_mm_grid)), 2), "max": round(float(np.max(tp_mm_grid)), 2)},
                    "cape_jkg": {"mean": round(float(np.mean(cape_grid)), 1), "max": round(float(np.max(cape_grid)), 1)},
                    "cin_jkg": {"mean": round(float(np.mean(cin_grid)), 1), "max": round(float(np.max(cin_grid)), 1)},
                    "b13_k": {"mean": round(float(np.mean(b13_grid)), 1), "min": round(float(np.min(b13_grid)), 1), "max": round(float(np.max(b13_grid)), 1)},
                },
                "t2m_grid": t2m_grid.tolist(),
                "d2m_grid": d2m_grid.tolist(),
                "wind_speed_grid": wind_speed_grid.tolist(),
                "precipitation_grid": tp_mm_grid.tolist(),
                "cape_grid": cape_grid.tolist(),
                "cin_grid": cin_grid.tolist(),
                "b13_grid": b13_grid.tolist(),
            }

            performance_diagnostics = {
                "acquisition_latency_ms": round((t_acq_end - t_acq_start) * 1000, 2),
                "normalization_latency_ms": round((t_norm_end - t_norm_start) * 1000, 2),
                "inference_latency_ms": round((t_infer_end - t_infer_start) * 1000, 2),
                "total_latency_ms": round(t_total * 1000, 2),
                "device": str(device),
            }

            # Compute observation freshness status
            live_data_status = "RECENT"
            try:
                obs_dt = datetime.fromisoformat(base_time_str.replace("Z", "+00:00"))
                now_utc = datetime.now(timezone.utc)
                diff_mins = max(0, int((now_utc - obs_dt).total_seconds() / 60))
                if diff_mins < 15:
                    live_data_status = "LIVE"
                elif diff_mins <= 30:
                    live_data_status = "RECENT"
                else:
                    live_data_status = "STALE"
            except Exception:
                pass

            complete_provenance = {
                "data_source": "NOAA Himawari-9 AHI + NOAA GFS 0.25° NWP",
                "observation_timestamp_utc": base_time_str,
                "observation_timestamp": base_time_str,
                "data_status": live_data_status,
                "ingest_status": "ONLINE",
                "forecast_valid_range": {
                    "start": target_times.get("30"),
                    "end": target_times.get("120"),
                },
                "synthetic_data_used": False,
                "base_time": base_time_str,
                "target_times": target_times,
                "observation_cadence": "10 minutes",
                "frame_timestamps": [f["target_timestamp"] for f in provenance["frames"]],
                "gfs_interpolation_metadata": [f["gfs_interpolation"] for f in provenance["frames"]],
                "channel_order": provenance["channel_order"],
                "grid_dimensions": provenance["grid_dimensions"],
                "atmospheric_observations": atmospheric_observations,
                "performance": performance_diagnostics,
                "model_metadata": {
                    "architecture": model.__class__.__name__,
                    "parameter_count": sum(p.numel() for p in model.parameters()),
                    "evaluation_mode": not model.training,
                    "target_semantics": settings.TARGET_SEMANTICS,
                }
            }

            from schemas import GridMetadata
            response = PredictResponse(
                status="success",
                model=settings.MODEL_NAME,
                data_mode="live",
                target=settings.TARGET_SEMANTICS,
                semantics=settings.OUTPUT_TYPE,
                unit="Probability [0.0 - 1.0]",
                base_time=base_time_str,
                forecast_horizons=settings.FORECAST_HORIZONS,
                target_times=target_times,
                grid_metadata=GridMetadata(
                    lat_min=8.0,
                    lat_max=38.0,
                    lon_min=68.0,
                    lon_max=98.0,
                    height=TARGET_HEIGHT,
                    width=TARGET_WIDTH
                ),
                horizons=horizons_dict,
                channels=settings.CHANNELS,
                provenance=complete_provenance,
            )

            # Cache valid response
            self._last_prediction = response
            self._last_base_time = base_time_str
            self._last_calc_time = curr_time

            logger.info(
                f"Successfully executed live nowcast inference for base_time: {base_time_str} "
                f"(Total time: {t_total*1000:.1f} ms, Device: {device})"
            )
            return response

    def predict_unified_live(self, target_time: Optional[datetime] = None) -> UnifiedNowcastResponse:
        """
        Executes canonical multi-model nowcasting across V1, V3, and V4 using real operational data.
        """
        with self._lock:
            t_start = time.perf_counter()

            if not model_manager.is_loaded():
                model_loaded = model_manager.load_models()
                if not model_loaded or not model_manager.is_loaded():
                    raise DataProviderError("MODEL_UNAVAILABLE: Checkpoints for V1, V3, or V4 could not be loaded.")

            device = model_manager.get_device()

            # Acquire & Align Real Operational Observations
            t_acq_start = time.perf_counter()
            try:
                physical_tensor, provenance = self.aligner.fetch_and_align(target_time)
            except HimawariUnavailableError as hue:
                logger.error(f"Live Himawari acquisition failed: {hue}")
                raise DataProviderError(f"HIMAWARI_DATA_UNAVAILABLE: {str(hue)}") from hue
            except GFSUnavailableError as gue:
                logger.error(f"Live GFS acquisition failed: {gue}")
                raise DataProviderError(f"GFS_DATA_UNAVAILABLE: {str(gue)}") from gue
            except TemporalAlignmentError as tae:
                logger.error(f"Live temporal alignment failed: {tae}")
                raise DataProviderError(f"TEMPORAL_ALIGNMENT_FAILED: {str(tae)}") from tae
            except DataValidationError as dve:
                logger.error(f"Live input validation failed: {dve}")
                raise DataProviderError(f"INVALID_V3_INPUT: {str(dve)}") from dve
            except Exception as e:
                logger.error(f"Unexpected operational pipeline failure: {e}")
                raise DataProviderError(f"OPERATIONAL_PIPELINE_ERROR: {str(e)}") from e

            t_acq_end = time.perf_counter()

            latest_frame_meta = provenance["frames"][-1]
            base_time_str = latest_frame_meta["target_timestamp"]
            base_dt = datetime.fromisoformat(base_time_str.replace("Z", "+00:00"))

            curr_time = time.time()
            if (
                self._last_unified_prediction is not None
                and self._last_unified_base_time == base_time_str
                and (curr_time - self._last_unified_calc_time) < self.cache_ttl_seconds
            ):
                logger.info(f"Serving cached unified nowcast for base_time: {base_time_str}")
                return self._last_unified_prediction

            target_times = {
                "30": (base_dt + timedelta(minutes=30)).isoformat(),
                "60": (base_dt + timedelta(minutes=60)).isoformat(),
                "90": (base_dt + timedelta(minutes=90)).isoformat(),
                "120": (base_dt + timedelta(minutes=120)).isoformat(),
            }

            # Atmospheric observations from latest frame
            latest_frame = physical_tensor[-1]
            b13_grid = latest_frame[0]
            t2m_grid = latest_frame[1]
            d2m_grid = latest_frame[2]
            u10_grid = latest_frame[3]
            v10_grid = latest_frame[4]
            cape_grid = latest_frame[5]
            cin_grid = latest_frame[6]
            tp_grid = latest_frame[7]

            wind_speed_grid = np.sqrt(u10_grid**2 + v10_grid**2) * 3.6  # km/h
            tp_mm_grid = tp_grid * 1000.0  # mm

            atmospheric_observations = {
                "domain_summary": {
                    "t2m_c": {"mean": round(float(np.mean(t2m_grid)), 1), "min": round(float(np.min(t2m_grid)), 1), "max": round(float(np.max(t2m_grid)), 1)},
                    "d2m_c": {"mean": round(float(np.mean(d2m_grid)), 1), "min": round(float(np.min(d2m_grid)), 1), "max": round(float(np.max(d2m_grid)), 1)},
                    "wind_speed_kmh": {"mean": round(float(np.mean(wind_speed_grid)), 1), "max": round(float(np.max(wind_speed_grid)), 1)},
                    "precipitation_mm": {"mean": round(float(np.mean(tp_mm_grid)), 2), "max": round(float(np.max(tp_mm_grid)), 2)},
                    "cape_jkg": {"mean": round(float(np.mean(cape_grid)), 1), "max": round(float(np.max(cape_grid)), 1)},
                    "cin_jkg": {"mean": round(float(np.mean(cin_grid)), 1), "max": round(float(np.max(cin_grid)), 1)},
                    "b13_k": {"mean": round(float(np.mean(b13_grid)), 1), "min": round(float(np.min(b13_grid)), 1), "max": round(float(np.max(b13_grid)), 1)},
                },
                "t2m_grid": t2m_grid.tolist(),
                "d2m_grid": d2m_grid.tolist(),
                "wind_speed_grid": wind_speed_grid.tolist(),
                "precipitation_grid": tp_mm_grid.tolist(),
                "cape_grid": cape_grid.tolist(),
                "cin_grid": cin_grid.tolist(),
                "b13_grid": b13_grid.tolist(),
            }

            # Compute observation freshness status
            data_status = "RECENT"
            try:
                obs_dt = datetime.fromisoformat(base_time_str.replace("Z", "+00:00"))
                now_utc = datetime.now(timezone.utc)
                diff_mins = max(0, int((now_utc - obs_dt).total_seconds() / 60))
                if diff_mins < 15:
                    data_status = "LIVE"
                elif diff_mins <= 30:
                    data_status = "RECENT"
                else:
                    data_status = "STALE"
            except Exception:
                pass

            t_infer_start = time.perf_counter()
            response = run_unified_nowcast_inference(
                physical_tensor=physical_tensor,
                data_mode="live",
                base_time_str=base_time_str,
                provenance_extra={
                    "data_source": "NOAA Himawari-9 AHI + NOAA GFS 0.25° NWP",
                    "observation_timestamp_utc": base_time_str,
                    "observation_timestamp": base_time_str,
                    "data_status": data_status,
                    "ingest_status": "ONLINE",
                    "forecast_valid_range": {
                        "start": target_times["30"],
                        "end": target_times["120"],
                    },
                    "synthetic_data_used": False,
                    "target_times": target_times,
                    "observation_cadence": "10 minutes",
                    "frame_timestamps": [f["target_timestamp"] for f in provenance["frames"]],
                    "gfs_interpolation_metadata": [f["gfs_interpolation"] for f in provenance["frames"]],
                    "channel_order": provenance["channel_order"],
                    "grid_dimensions": provenance["grid_dimensions"],
                    "atmospheric_observations": atmospheric_observations,
                    "performance": {
                        "acquisition_latency_ms": round((t_acq_end - t_acq_start) * 1000, 2),
                        "device": str(device),
                    },
                }
            )
            t_infer_end = time.perf_counter()
            infer_ms = round((t_infer_end - t_infer_start) * 1000, 2)
            total_ms = round((t_infer_end - t_start) * 1000, 2)
            if response.provenance and "performance" in response.provenance:
                response.provenance["performance"]["inference_latency_ms"] = infer_ms
                response.provenance["performance"]["total_latency_ms"] = total_ms

            self._last_unified_prediction = response
            self._last_unified_base_time = base_time_str
            self._last_unified_calc_time = curr_time

            return response


class OperationalDataProvider(BaseDataProvider):
    """
    Standard DataProvider adapter implementing BaseDataProvider interface.
    Delegates to SpatiotemporalAligner and LivePredictionService for live operational workflows.
    """

    def __init__(self, aligner: Optional[SpatiotemporalAligner] = None):
        self.aligner = aligner or SpatiotemporalAligner()
        self.service = LivePredictionService(aligner=self.aligner)

    @property
    def provider_name(self) -> str:
        return "operational_nwp_satellite"

    @property
    def is_live(self) -> bool:
        return True

    def fetch_frames(self, target_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Fetches operational atmospheric data and constructs 6 synchronized frames
        directly from the real SpatiotemporalAligner pipeline.
        """
        physical_tensor, provenance = self.aligner.fetch_and_align(target_time)

        frames = []
        for t_idx, frame_meta in enumerate(provenance["frames"]):
            frame_dict = {
                "timestamp": frame_meta["target_timestamp"],
                "B13": physical_tensor[t_idx, 0, :, :].tolist(),
                "t2m": physical_tensor[t_idx, 1, :, :].tolist(),
                "d2m": physical_tensor[t_idx, 2, :, :].tolist(),
                "u10": physical_tensor[t_idx, 3, :, :].tolist(),
                "v10": physical_tensor[t_idx, 4, :, :].tolist(),
                "cape": physical_tensor[t_idx, 5, :, :].tolist(),
                "cin": physical_tensor[t_idx, 6, :, :].tolist(),
                "tp": physical_tensor[t_idx, 7, :, :].tolist(),
            }
            frames.append(frame_dict)

        return frames

    def predict_live(self, target_time: Optional[datetime] = None) -> PredictResponse:
        """Executes full real-data live nowcasting inference."""
        return self.service.predict_live(target_time)

    def predict_unified_live(self, target_time: Optional[datetime] = None) -> UnifiedNowcastResponse:
        """Executes canonical multi-model unified live nowcast inference."""
        return self.service.predict_unified_live(target_time)


# Global singleton instance for live prediction service
live_prediction_service = LivePredictionService()
