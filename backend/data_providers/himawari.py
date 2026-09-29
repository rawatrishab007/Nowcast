"""
WeatherNow AI — Real Himawari-8/9 AHI Band 13 Satellite Data Ingestion Pipeline
Handles AWS Open Data HSD retrieval, binary parsing, Planck calibration,
geostationary coordinate transformation, and deterministic 128x128 grid extraction over India.
"""

import os
import bz2
import struct
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import httpx

from config import settings
from .base import DataProviderError, DataValidationError
from .spatial import LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, TARGET_HEIGHT, TARGET_WIDTH

logger = logging.getLogger("weathernow.data_providers.himawari")

# Constants for Himawari Geostationary Projection
HIMAWARI_SUB_LON = 140.7
HIMAWARI_SUB_LON_RAD = np.deg2rad(HIMAWARI_SUB_LON)
HIMAWARI_DISTANCE_KM = 42164.0
EARTH_REQ_KM = 6378.137
EARTH_RPOL_KM = 6356.7523
EARTH_E2 = (EARTH_REQ_KM**2 - EARTH_RPOL_KM**2) / (EARTH_REQ_KM**2)

COFF_DEFAULT = 2750.5
LOFF_DEFAULT = 2750.5
CFAC_DEFAULT = 20466275.0
LFAC_DEFAULT = 20466275.0


class HimawariUnavailableError(DataProviderError):
    """Raised when real Himawari observations cannot be retrieved or processed."""
    pass


class HimawariHSDParser:
    """
    Parses Himawari Standard Data (HSD) binary files and calibrates raw counts to Kelvin.
    """

    @staticmethod
    def parse_hsd_segment(raw_bytes: bytes) -> Tuple[Dict[str, Any], np.ndarray]:
        """
        Parses an uncompressed HSD binary segment and returns (metadata_dict, count_image_2d).
        """
        if len(raw_bytes) < 1523:
            raise DataValidationError("HSD segment byte stream is too short or malformed.")

        # 1. Parse Block 1 (Basic Info)
        total_hdr_len = struct.unpack('<I', raw_bytes[70:74])[0]
        sat_name = raw_bytes[6:22].decode('ascii', errors='ignore').strip('\x00').strip()
        obs_area = raw_bytes[38:42].decode('ascii', errors='ignore').strip()
        timeline = struct.unpack('<H', raw_bytes[44:46])[0]

        # 2. Parse Block 2 (Data Info)
        b1_len = struct.unpack('<H', raw_bytes[1:3])[0]
        b2_offset = b1_len
        ncols = struct.unpack('<H', raw_bytes[b2_offset+5:b2_offset+7])[0]
        nlines = struct.unpack('<H', raw_bytes[b2_offset+7:b2_offset+9])[0]

        # 3. Parse Block 3 (Projection) & Block 5 (Calibration)
        offset = 0
        b5_calib = {}
        b3_proj = {}

        while offset < total_hdr_len:
            b_id = raw_bytes[offset]
            b_len = struct.unpack('<H', raw_bytes[offset+1:offset+3])[0]
            if b_len == 0:
                break

            if b_id == 3:  # Projection Block
                sub_lon = struct.unpack('<d', raw_bytes[offset+3:offset+11])[0]
                cfac = struct.unpack('<I', raw_bytes[offset+11:offset+15])[0]
                lfac = struct.unpack('<I', raw_bytes[offset+15:offset+19])[0]
                coff = struct.unpack('<f', raw_bytes[offset+19:offset+23])[0]
                loff = struct.unpack('<f', raw_bytes[offset+23:offset+27])[0]
                b3_proj = {
                    'sub_lon': sub_lon,
                    'cfac': float(cfac),
                    'lfac': float(lfac),
                    'coff': float(coff),
                    'loff': float(loff),
                }

            elif b_id == 5:  # Calibration Block
                b5 = raw_bytes[offset:offset+b_len]
                band = struct.unpack('<H', b5[3:5])[0]
                wl = struct.unpack('<d', b5[5:13])[0]
                gain = struct.unpack('<d', b5[19:27])[0]
                const = struct.unpack('<d', b5[27:35])[0]
                c0 = struct.unpack('<d', b5[35:43])[0]
                c1 = struct.unpack('<d', b5[43:51])[0]
                c2 = struct.unpack('<d', b5[51:59])[0]
                c_speed = struct.unpack('<d', b5[83:91])[0]
                h_planck = struct.unpack('<d', b5[91:99])[0]
                k_boltz = struct.unpack('<d', b5[99:107])[0]

                b5_calib = {
                    'band': band,
                    'wl_um': wl,
                    'gain': gain,
                    'const': const,
                    'c0': c0,
                    'c1': c1,
                    'c2': c2,
                    'c_speed': c_speed,
                    'h_planck': h_planck,
                    'k_boltz': k_boltz,
                }

            offset += b_len

        # 4. Extract 16-bit unsigned count matrix
        img_bytes_len = nlines * ncols * 2
        img_data = np.frombuffer(
            raw_bytes[total_hdr_len:total_hdr_len + img_bytes_len],
            dtype='<u2'
        ).reshape((nlines, ncols))

        metadata = {
            'satellite': sat_name,
            'area': obs_area,
            'timeline': timeline,
            'nlines': nlines,
            'ncols': ncols,
            'projection': b3_proj,
            'calibration': b5_calib,
        }

        return metadata, img_data

    @staticmethod
    def counts_to_kelvin(counts: np.ndarray, calib: Dict[str, Any]) -> np.ndarray:
        """
        Converts 16-bit Himawari AHI Band 13 counts to Brightness Temperature in Kelvin
        using the official JMA Planck function and effective temperature correction.
        """
        counts_f = counts.astype(np.float64)
        # Radiance in W / (m^2 * sr * um)
        radiance = calib['gain'] * counts_f + calib['const']
        # Radiance in SI: W / (m^2 * sr * m)
        radiance_si = np.maximum(radiance * 1e6, 1e-10)

        wl_m = calib['wl_um'] * 1e-6
        c1_planck = 2.0 * calib['h_planck'] * (calib['c_speed'] ** 2)
        c2_planck = (calib['h_planck'] * calib['c_speed']) / calib['k_boltz']

        # Effective temperature Te (K)
        te = c2_planck / (wl_m * np.log((c1_planck / ((wl_m ** 5) * radiance_si)) + 1.0))
        # Corrected Brightness Temperature Tb (K)
        tb = calib['c0'] + calib['c1'] * te + calib['c2'] * (te ** 2)

        return tb.astype(np.float32)


class HimawariCoordinateTransformer:
    """
    Computes geostationary projection scanning coordinates and pixel mappings
    from WGS84 geographic lat/lon grid onto Himawari AHI Full Disk pixels.
    """

    @staticmethod
    def get_sampling_grid_coordinates(
        target_lats: np.ndarray,
        target_lons: np.ndarray,
        coff: float = COFF_DEFAULT,
        loff: float = LOFF_DEFAULT,
        cfac: float = CFAC_DEFAULT,
        lfac: float = LFAC_DEFAULT
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calculates Full Disk column and line indices for target lat/lon meshgrid.
        
        Returns:
            (cols, lines): 2D float64 arrays matching meshgrid shape
        """
        lat_mesh, lon_mesh = np.meshgrid(target_lats, target_lons, indexing='ij')

        lat_rad = np.deg2rad(lat_mesh)
        lon_rad = np.deg2rad(lon_mesh)

        phi_c = np.arctan((EARTH_RPOL_KM**2 / EARTH_REQ_KM**2) * np.tan(lat_rad))
        rc = EARTH_RPOL_KM / np.sqrt(1.0 - EARTH_E2 * (np.cos(phi_c)**2))

        rx = rc * np.cos(phi_c) * np.cos(lon_rad - HIMAWARI_SUB_LON_RAD)
        ry = rc * np.cos(phi_c) * np.sin(lon_rad - HIMAWARI_SUB_LON_RAD)
        rz = rc * np.sin(phi_c)

        sx = HIMAWARI_DISTANCE_KM - rx
        sy = -ry
        sz = rz

        x_deg = np.rad2deg(np.arctan2(-sy, sx))
        y_deg = np.rad2deg(np.arcsin(sz / np.sqrt(sx**2 + sy**2 + sz**2)))

        cols = coff + x_deg * (cfac / (2**16))
        lines = loff - y_deg * (lfac / (2**16))

        return cols, lines


class HimawariDownloader:
    """
    Ingests real Himawari-9 AHI Band 13 data from AWS Open Data public archive.
    Stitches regional segments (S0210, S0310, S0410, S0510) and extracts 128x128 Kelvin matrix.
    """

    def __init__(
        self,
        base_s3_url: str = "https://noaa-himawari9.s3.amazonaws.com",
        cache_dir: Optional[str] = None,
        timeout_seconds: float = 25.0
    ):
        self.base_s3_url = base_s3_url
        self.timeout = timeout_seconds
        
        # Set cache directory
        if cache_dir:
            self.cache_dir = cache_dir
        else:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.cache_dir = os.path.join(base_dir, "data_cache", "himawari")

        os.makedirs(self.cache_dir, exist_ok=True)

    def fetch_b13_observation(self, target_time: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Retrieves, calibrates, and reprojects a single real Himawari Band 13 observation.
        
        Returns:
            Dict containing:
              - 'grid': 128x128 2D list of float (Brightness Temp in Kelvin)
              - 'timestamp': Actual observation ISO timestamp
              - 'min_kelvin': Minimum observed Kelvin temperature
              - 'max_kelvin': Maximum observed Kelvin temperature
              - 'mean_kelvin': Mean observed Kelvin temperature
              - 'source': Source S3 archive path
        """
        ref_time = target_time or datetime.now(timezone.utc)
        # Round to nearest 10-minute scan slot
        scan_min = (ref_time.minute // 10) * 10
        scan_dt = ref_time.replace(minute=scan_min, second=0, microsecond=0)

        year = scan_dt.strftime("%Y")
        month = scan_dt.strftime("%m")
        day = scan_dt.strftime("%d")
        hhmm = scan_dt.strftime("%H%M")
        dt_str = scan_dt.strftime("%Y%m%d_%H%M")

        slot_prefix = f"AHI-L1b-FLDK/{year}/{month}/{day}/{hhmm}"
        base_slot_url = f"{self.base_s3_url}/{slot_prefix}"

        # Indian domain (8N-38N) spans segments 2, 3, 4, 5 (lines 550 to 2750)
        target_segments = [2, 3, 4, 5]
        segment_imgs = []
        calib_meta = None
        proj_meta = None

        logger.info(f"Retrieving Himawari-9 B13 scan for slot: {slot_prefix}")

        for seg_idx in target_segments:
            seg_filename = f"HS_H09_{dt_str}_B13_FLDK_R20_S{seg_idx:02d}10.DAT.bz2"
            local_path = os.path.join(self.cache_dir, seg_filename)

            # Check cache or download
            raw_bytes = None
            if os.path.exists(local_path) and os.path.getsize(local_path) > 1000:
                with open(local_path, "rb") as f:
                    compressed = f.read()
            else:
                download_url = f"{base_slot_url}/{seg_filename}"
                try:
                    with httpx.Client(timeout=self.timeout) as client:
                        resp = client.get(download_url)
                        if resp.status_code != 200:
                            raise HimawariUnavailableError(
                                f"Live Himawari B13 unavailable: HTTP {resp.status_code} for {download_url}"
                            )
                        compressed = resp.content
                        with open(local_path, "wb") as f:
                            f.write(compressed)
                except Exception as e:
                    raise HimawariUnavailableError(
                        f"Live Himawari B13 network retrieval failed for {seg_filename}: {str(e)}"
                    ) from e

            # Decompress BZ2
            try:
                decompressed = bz2.decompress(compressed)
            except Exception as e:
                raise DataValidationError(f"Failed to decompress HSD segment {seg_filename}: {str(e)}")

            meta, seg_counts = HimawariHSDParser.parse_hsd_segment(decompressed)
            segment_imgs.append(seg_counts)

            if calib_meta is None and meta.get('calibration'):
                calib_meta = meta['calibration']
            if proj_meta is None and meta.get('projection'):
                proj_meta = meta['projection']

        if not calib_meta:
            raise DataValidationError("Missing calibration block in Himawari HSD stream.")

        # Stitch segments vertically (Shape: 2200 lines x 5500 columns, lines 550 to 2750)
        stitched_counts = np.vstack(segment_imgs)
        line_offset = 550.0

        # Construct target 128x128 geographic grid: 38N down to 8N, 68E up to 98E
        lats_target = np.linspace(LAT_MAX, LAT_MIN, TARGET_HEIGHT)
        lons_target = np.linspace(LON_MIN, LON_MAX, TARGET_WIDTH)

        coff = proj_meta.get('coff', COFF_DEFAULT) if proj_meta else COFF_DEFAULT
        loff = proj_meta.get('loff', LOFF_DEFAULT) if proj_meta else LOFF_DEFAULT
        cfac = proj_meta.get('cfac', CFAC_DEFAULT) if proj_meta else CFAC_DEFAULT
        lfac = proj_meta.get('lfac', LFAC_DEFAULT) if proj_meta else LFAC_DEFAULT

        cols, lines = HimawariCoordinateTransformer.get_sampling_grid_coordinates(
            lats_target, lons_target, coff=coff, loff=loff, cfac=cfac, lfac=lfac
        )

        # Map to stitched segment local coordinates
        local_lines = lines - line_offset

        c_idx = np.clip(np.round(cols).astype(int), 0, 5499)
        l_idx = np.clip(np.round(local_lines).astype(int), 0, stitched_counts.shape[0] - 1)

        sampled_counts = stitched_counts[l_idx, c_idx]

        # Calibrate sampled counts to Brightness Temperature in Kelvin
        b13_grid_kelvin = HimawariHSDParser.counts_to_kelvin(sampled_counts, calib_meta)

        # Validate physical range bounds
        min_k = float(b13_grid_kelvin.min())
        max_k = float(b13_grid_kelvin.max())
        mean_k = float(b13_grid_kelvin.mean())

        if np.isnan(b13_grid_kelvin).any() or np.isinf(b13_grid_kelvin).any():
            raise DataValidationError("Real Himawari B13 grid contains NaN or Infinite values.")

        if min_k < 150.0 or max_k > 350.0:
            logger.warning(f"Himawari B13 Kelvin range advisory: [{min_k:.1f} K, {max_k:.1f} K]")

        return {
            'grid': b13_grid_kelvin.tolist(),
            'timestamp': scan_dt.isoformat(),
            'min_kelvin': min_k,
            'max_kelvin': max_k,
            'mean_kelvin': mean_k,
            'source': f"{slot_prefix} (Segments S0210-S0510)",
        }

    def find_latest_cached_slot(self, count: int = settings.INPUT_FRAMES) -> Optional[datetime]:
        """
        Scans cache directory for the latest complete sequence of valid Himawari observation files.
        """
        if not os.path.exists(self.cache_dir):
            return None

        import glob
        pattern = os.path.join(self.cache_dir, "HS_H09_*_*_B13_FLDK_R20_S0210.DAT.bz2")
        files = sorted(glob.glob(pattern))
        if not files:
            return None

        available_slots = []
        for f in files:
            base = os.path.basename(f)
            parts = base.split("_")
            if len(parts) >= 4:
                date_str, time_str = parts[2], parts[3]
                try:
                    dt = datetime.strptime(f"{date_str}{time_str}", "%Y%m%d%H%M").replace(tzinfo=timezone.utc)
                    all_segs = True
                    for seg in ["S0210", "S0310", "S0410", "S0510"]:
                        seg_file = os.path.join(self.cache_dir, f"HS_H09_{date_str}_{time_str}_B13_FLDK_R20_{seg}.DAT.bz2")
                        if not os.path.exists(seg_file) or os.path.getsize(seg_file) < 1000:
                            all_segs = False
                            break
                    if all_segs:
                        available_slots.append(dt)
                except Exception:
                    pass

        if len(available_slots) < count:
            return None

        available_slots.sort()
        for i in range(len(available_slots) - 1, count - 2, -1):
            cand_end = available_slots[i]
            is_valid_seq = True
            for k in range(1, count):
                expected_prev = cand_end - timedelta(minutes=k * settings.FRAME_INTERVAL_MINUTES)
                if expected_prev not in available_slots:
                    is_valid_seq = False
                    break
            if is_valid_seq:
                return cand_end

        return None

    def fetch_b13_sequence(
        self,
        target_time: Optional[datetime] = None,
        count: int = settings.INPUT_FRAMES
    ) -> List[Dict[str, Any]]:
        """
        Retrieves a temporal sequence of real consecutive 10-minute Himawari observations (t-50m to t).
        """
        if target_time is not None:
            scan_min = (target_time.minute // 10) * 10
            base_slot = target_time.replace(minute=scan_min, second=0, microsecond=0)
        else:
            # Operational satellite delay is typically ~20-30 minutes from real-time UTC
            now_utc = datetime.now(timezone.utc) - timedelta(minutes=30)
            scan_min = (now_utc.minute // 10) * 10
            base_slot = now_utc.replace(minute=scan_min, second=0, microsecond=0)

        sequence = []
        try:
            for i in range(count):
                slot_time = base_slot - timedelta(minutes=(count - 1 - i) * settings.FRAME_INTERVAL_MINUTES)
                obs = self.fetch_b13_observation(slot_time)
                sequence.append(obs)
            return sequence
        except HimawariUnavailableError:
            # If tentative live slot failed and target_time was not explicitly specified,
            # discover the latest available complete cached observation sequence
            if target_time is None:
                cached_slot = self.find_latest_cached_slot(count=count)
                if cached_slot is not None:
                    logger.info(f"Discovered latest valid complete Himawari sequence at cached slot: {cached_slot.isoformat()}")
                    sequence = []
                    for i in range(count):
                        slot_time = cached_slot - timedelta(minutes=(count - 1 - i) * settings.FRAME_INTERVAL_MINUTES)
                        obs = self.fetch_b13_observation(slot_time)
                        sequence.append(obs)
                    return sequence
            raise

