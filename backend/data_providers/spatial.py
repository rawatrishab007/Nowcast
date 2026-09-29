"""
WeatherNow AI — Geospatial Processing & Unit Conversion Utilities
Handles spatial reprojection, bilinear grid interpolation, and meteorological unit conversions.
"""

from typing import Tuple
import numpy as np
import torch
import torch.nn.functional as F

from config import settings

# Geospatial Domain Bounds
LAT_MIN = 8.0
LAT_MAX = 38.0
LON_MIN = 68.0
LON_MAX = 98.0
TARGET_HEIGHT = 128
TARGET_WIDTH = 128


def interpolate_to_target_grid(
    source_grid: np.ndarray,
    src_lats: np.ndarray,
    src_lons: np.ndarray,
    mode: str = "bilinear"
) -> np.ndarray:
    """
    Interpolates a 2D atmospheric field from an arbitrary regular lat/lon grid
    onto the exact SIH V3 128x128 target domain (8°N–38°N, 68°E–98°E).

    Args:
        source_grid: 2D numpy array of shape (len(src_lats), len(src_lons))
        src_lats: 1D array of source latitudes (must be monotonic, e.g. 38 down to 8 or 8 up to 38)
        src_lons: 1D array of source longitudes (must be monotonic, e.g. 68 up to 98)
        mode: PyTorch interpolation mode ('bilinear' or 'nearest')

    Returns:
        2D numpy array of shape (128, 128) float32
    """
    # 1. Ensure source latitudes are strictly descending (North to South, row 0 = max lat)
    grid = np.asarray(source_grid, dtype=np.float32)
    lats = np.asarray(src_lats, dtype=np.float32)
    lons = np.asarray(src_lons, dtype=np.float32)

    if lats[0] < lats[-1]:
        # Ascending latitudes: flip along axis 0
        grid = np.flip(grid, axis=0)
        lats = np.flip(lats)

    # 2. Crop to target bounding box with a 1-pixel safety border
    lat_mask = (lats >= LAT_MIN - 1.0) & (lats <= LAT_MAX + 1.0)
    lon_mask = (lons >= LON_MIN - 1.0) & (lons <= LON_MAX + 1.0)

    cropped_grid = grid[lat_mask][:, lon_mask]
    cropped_lats = lats[lat_mask]
    cropped_lons = lons[lon_mask]

    # Convert to 4D PyTorch tensor: (Batch=1, Channels=1, H_src, W_src)
    tensor = torch.from_numpy(cropped_grid).unsqueeze(0).unsqueeze(0)

    # Interpolate directly to (128, 128) using bilinear resampling
    interpolated = F.interpolate(
        tensor,
        size=(TARGET_HEIGHT, TARGET_WIDTH),
        mode=mode,
        align_corners=True
    )

    result = interpolated.squeeze(0).squeeze(0).cpu().numpy().astype(np.float32)
    return result


# ==============================================================================
# UNIT CONVERSION UTILITIES
# ==============================================================================

def kelvin_to_celsius(temp_k: np.ndarray) -> np.ndarray:
    """
    Converts temperature from Kelvin to Celsius (°C = K - 273.15).
    Used for NWP 2m temperature (t2m) and dewpoint (d2m).
    """
    return np.asarray(temp_k, dtype=np.float32) - 273.15


def celsius_to_kelvin(temp_c: np.ndarray) -> np.ndarray:
    """
    Converts temperature from Celsius to Kelvin (K = °C + 273.15).
    """
    return np.asarray(temp_c, dtype=np.float32) + 273.15


def mm_to_meters(precip_mm: np.ndarray) -> np.ndarray:
    """
    Converts precipitation from mm (or kg/m²) to meters (m = mm / 1000.0).
    Used for ERA5 / GFS total precipitation (tp).
    """
    return np.asarray(precip_mm, dtype=np.float32) / 1000.0


def meters_to_mm(precip_m: np.ndarray) -> np.ndarray:
    """
    Converts precipitation from meters to mm.
    """
    return np.asarray(precip_m, dtype=np.float32) * 1000.0


def wind_components_from_speed_dir(
    speed_ms: np.ndarray,
    direction_deg: np.ndarray
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes u (east-west) and v (north-south) wind components from meteorological
    wind speed (m/s) and meteorological direction (degrees from where the wind blows).
    
    Formula:
        u = -speed * sin(rad(dir))
        v = -speed * cos(rad(dir))
    """
    rad = np.deg2rad(direction_deg)
    u = -speed_ms * np.sin(rad)
    v = -speed_ms * np.cos(rad)
    return u.astype(np.float32), v.astype(np.float32)
