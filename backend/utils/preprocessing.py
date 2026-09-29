import numpy as np
import torch
from typing import List, Dict, Any
from config import settings

class PreprocessingError(ValueError):
    """Custom exception raised during input frame validation or normalization."""
    pass


def prepare_input_tensor(frames: List[Dict[str, Any]], device: torch.device) -> torch.Tensor:
    """
    Assembles, validates, and normalizes a sequence of frames into a PyTorch tensor.

    Input:
        frames: List of 6 frame dicts, each with keys ["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]
                where each value is a 128x128 2D matrix (list of lists or numpy array).
        device: Target torch.device (CUDA, MPS, or CPU).

    Output:
        Normalized tensor of shape (1, 6, 8, 128, 128) on the designated device.
    """
    # 1. Validate number of frames
    if len(frames) != settings.INPUT_FRAMES:
        raise PreprocessingError(
            f"Expected exactly {settings.INPUT_FRAMES} temporal frames, received {len(frames)}."
        )

    # 2. Build numpy array of shape (6, 8, 128, 128) in EXACT channel order
    # Channel order: ["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"]
    tensor_data = np.zeros(
        (settings.INPUT_FRAMES, len(settings.CHANNELS), settings.HEIGHT, settings.WIDTH),
        dtype=np.float32
    )

    for t_idx, frame in enumerate(frames):
        for c_idx, ch_name in enumerate(settings.CHANNELS):
            if ch_name not in frame:
                raise PreprocessingError(
                    f"Frame {t_idx} is missing required channel '{ch_name}'."
                )

            raw_channel_data = frame[ch_name]
            try:
                ch_array = np.asarray(raw_channel_data, dtype=np.float32)
            except Exception as e:
                raise PreprocessingError(
                    f"Failed to parse numerical array for frame {t_idx}, channel '{ch_name}': {str(e)}"
                )

            if ch_array.shape != (settings.HEIGHT, settings.WIDTH):
                raise PreprocessingError(
                    f"Frame {t_idx}, channel '{ch_name}' has shape {ch_array.shape}, "
                    f"expected ({settings.HEIGHT}, {settings.WIDTH})."
                )

            if np.isnan(ch_array).any() or np.isinf(ch_array).any():
                raise PreprocessingError(
                    f"Frame {t_idx}, channel '{ch_name}' contains NaN or infinite values."
                )

            tensor_data[t_idx, c_idx] = ch_array

    # 3. Apply EXACT Fixed Normalization using training-set MEAN and STD
    # Formula: x_norm = (x - MEAN) / STD across channel axis
    # MEAN shape: (8,), broadcasted to (1, 8, 1, 1) against (6, 8, 128, 128)
    mean_broadcast = settings.MEAN[None, :, None, None]
    std_broadcast = settings.STD[None, :, None, None]

    normalized_data = (tensor_data - mean_broadcast) / std_broadcast

    # 4. Add batch dimension: (6, 8, 128, 128) -> (1, 6, 8, 128, 128)
    batched_data = np.expand_dims(normalized_data, axis=0)

    # 5. Convert to PyTorch Tensor and transfer to execution device
    tensor = torch.from_numpy(batched_data).to(device)
    return tensor
