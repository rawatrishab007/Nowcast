"""
WeatherNow AI — V3 Preprocessing & Normalization Pipeline (Phase 1D)
Handles deterministic physical unit checks, frozen V3 normalization,
tensor assembly (1, 6, 8, 128, 128), and validation against frozen SIHV3Nowcast contract.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import torch

from config import settings
from .base import DataValidationError
from .alignment import CHANNEL_NAMES, NUM_CHANNELS, NUM_FRAMES, PHYSICAL_BOUNDS
from .spatial import TARGET_HEIGHT, TARGET_WIDTH

logger = logging.getLogger("weathernow.data_providers.v3_preprocessing")

# ==============================================================================
# FROZEN V3 NORMALIZATION CONSTANTS
# DO NOT MODIFY OR RECOMPUTE DYNAMICALLY
# ==============================================================================

V3_FROZEN_MEAN = np.array([
    258.9513,  # Channel 0: B13 (Kelvin)
    24.3378,   # Channel 1: t2m (°C)
    17.6339,   # Channel 2: d2m (°C)
    2.7062,    # Channel 3: u10 (m/s)
    1.7265,    # Channel 4: v10 (m/s)
    720.3760,  # Channel 5: CAPE (J/kg)
    90.9589,   # Channel 6: CIN (J/kg)
    0.0002     # Channel 7: tp (meters)
], dtype=np.float32)

V3_FROZEN_STD = np.array([
    12.8962,   # Channel 0: B13 (Kelvin)
    11.2362,   # Channel 1: t2m (°C)
    11.1469,   # Channel 2: d2m (°C)
    2.8719,    # Channel 3: u10 (m/s)
    2.7279,    # Channel 4: v10 (m/s)
    851.9800,  # Channel 5: CAPE (J/kg)
    145.4562,  # Channel 6: CIN (J/kg)
    0.0007     # Channel 7: tp (meters)
], dtype=np.float32)

# Verify length matches expected 8 channels
assert len(V3_FROZEN_MEAN) == NUM_CHANNELS, "V3_FROZEN_MEAN length mismatch"
assert len(V3_FROZEN_STD) == NUM_CHANNELS, "V3_FROZEN_STD length mismatch"


def verify_physical_units_and_ranges(physical_tensor: np.ndarray) -> Dict[str, Dict[str, float]]:
    """
    Verifies that the unnormalized physical tensor adheres to expected shape, dtype,
    finite numbers, and realistic meteorological bounds.
    """
    if not isinstance(physical_tensor, np.ndarray):
        raise DataValidationError(f"Expected numpy.ndarray, got {type(physical_tensor)}.")

    if physical_tensor.shape != (NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH):
        raise DataValidationError(
            f"Expected physical tensor shape ({NUM_FRAMES}, {NUM_CHANNELS}, {TARGET_HEIGHT}, {TARGET_WIDTH}), "
            f"got {physical_tensor.shape}."
        )

    if physical_tensor.dtype != np.float32:
        raise DataValidationError(f"Expected dtype float32, got {physical_tensor.dtype}.")

    if np.isnan(physical_tensor).any():
        raise DataValidationError("Physical tensor contains NaN values.")

    if np.isinf(physical_tensor).any():
        raise DataValidationError("Physical tensor contains Infinite values.")

    stats: Dict[str, Dict[str, float]] = {}
    for c_idx, ch_name in enumerate(CHANNEL_NAMES):
        ch_slice = physical_tensor[:, c_idx, :, :]
        c_min = float(np.min(ch_slice))
        c_max = float(np.max(ch_slice))
        c_mean = float(np.mean(ch_slice))
        c_std = float(np.std(ch_slice))

        valid_min, valid_max = PHYSICAL_BOUNDS[ch_name]
        if c_min < valid_min or c_max > valid_max:
            logger.warning(
                f"Channel {c_idx} ({ch_name}) physical range check: "
                f"[{c_min:.3f}, {c_max:.3f}] outside nominal [{valid_min}, {valid_max}]."
            )

        stats[ch_name] = {
            "channel_index": c_idx,
            "min": c_min,
            "max": c_max,
            "mean": c_mean,
            "std": c_std,
            "frozen_mean": float(V3_FROZEN_MEAN[c_idx]),
            "frozen_std": float(V3_FROZEN_STD[c_idx]),
        }

    return stats


def normalize_for_v3(physical_tensor: np.ndarray) -> np.ndarray:
    """
    Applies EXACT frozen V3 normalization to an unnormalized physical sequence tensor.

    Input:
        physical_tensor: np.ndarray of shape (6, 8, 128, 128) and dtype float32 in physical units:
            Channel 0 = B13 [K]
            Channel 1 = t2m [°C]
            Channel 2 = d2m [°C]
            Channel 3 = u10 [m/s]
            Channel 4 = v10 [m/s]
            Channel 5 = CAPE [J/kg]
            Channel 6 = CIN [J/kg]
            Channel 7 = tp [m]

    Formula:
        normalized = (physical - MEAN[c]) / STD[c] independently across channel axis.

    Output:
        normalized_tensor: np.ndarray of shape (6, 8, 128, 128) and dtype float32.
    """
    # 1. Strict input validation
    verify_physical_units_and_ranges(physical_tensor)

    # 2. Broadcast frozen MEAN and STD: shape (1, 8, 1, 1) against (6, 8, 128, 128)
    mean_broadcast = V3_FROZEN_MEAN[None, :, None, None]
    std_broadcast = V3_FROZEN_STD[None, :, None, None]

    normalized = (physical_tensor - mean_broadcast) / std_broadcast

    # 3. Post-normalization validation
    if normalized.shape != (NUM_FRAMES, NUM_CHANNELS, TARGET_HEIGHT, TARGET_WIDTH):
        raise DataValidationError(f"Normalized tensor shape mismatch: {normalized.shape}")

    if normalized.dtype != np.float32:
        normalized = normalized.astype(np.float32)

    if np.isnan(normalized).any() or np.isinf(normalized).any():
        raise DataValidationError("Normalized tensor contains NaN or Infinite values.")

    return normalized


def construct_v3_input_tensor(
    physical_tensor: np.ndarray,
    device: Optional[Union[str, torch.device]] = None
) -> torch.Tensor:
    """
    Converts physical (6, 8, 128, 128) array to normalized batched PyTorch tensor of shape (1, 6, 8, 128, 128).

    Args:
        physical_tensor: unnormalized sequence array of shape (6, 8, 128, 128) float32.
        device: optional torch device target.

    Returns:
        torch.Tensor of shape (1, 6, 8, 128, 128), dtype torch.float32, contiguous on target device.
    """
    normalized_np = normalize_for_v3(physical_tensor)

    # Add batch dimension: (6, 8, 128, 128) -> (1, 6, 8, 128, 128)
    batched_np = np.expand_dims(normalized_np, axis=0)

    tensor = torch.from_numpy(batched_np).contiguous()

    if device is not None:
        target_dev = torch.device(device) if isinstance(device, str) else device
        tensor = tensor.to(target_dev)

    return tensor
