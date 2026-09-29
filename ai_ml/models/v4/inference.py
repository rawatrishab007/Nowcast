from pathlib import Path
from typing import Dict, Any, List, Union
import numpy as np
import torch

from model import SIHV4RainfallNowcast

INPUT_FRAMES = 6
INPUT_CHANNELS = 8
GRID_SIZE = 128
HORIZONS = 4

CHANNELS = [
    "B13",
    "t2m",
    "d2m",
    "u10",
    "v10",
    "cape",
    "cin",
    "tp",
]

HORIZON_MINUTES = [30, 60, 90, 120]

TRAIN_MEAN = np.array([
    258.78702,
    24.27609,
    17.63431,
    2.67183,
    1.71813,
    708.90601,
    91.13150,
    0.00023,
], dtype=np.float32)

TRAIN_STD = np.array([
    12.77990,
    11.26621,
    11.18628,
    2.89772,
    2.72003,
    846.71869,
    146.23935,
    0.00073,
], dtype=np.float32)

DEVICE = torch.device(
    "mps"
    if torch.backends.mps.is_available()
    else "cpu"
)

MODEL_PATH = Path(__file__).resolve().parent / "sih_v4_rain_corrected_best.pth"


class V4RainfallInference:
    """
    Dedicated inference engine for SIH V4 Rainfall Nowcasting.
    Loads sih_v4_rain_corrected_best.pth and produces:
      - Rainfall intensity (mm/hr): expm1(logits).clamp(min=0.0)
      - Rain occurrence probability: sigmoid(logits)
    """
    def __init__(self, checkpoint_path: Union[str, Path] = MODEL_PATH, device: torch.device = DEVICE):
        self.device = device
        self.model = SIHV4RainfallNowcast(
            in_channels=INPUT_CHANNELS,
            hidden_channels=32,
            horizons=HORIZONS
        )

        checkpoint = torch.load(str(checkpoint_path), map_location=self.device)
        if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
            self.model.load_state_dict(checkpoint["state_dict"])
        elif isinstance(checkpoint, dict):
            self.model.load_state_dict(checkpoint)

        self.model.to(self.device)
        self.model.eval()

    def prepare_input(self, x_raw: np.ndarray) -> torch.Tensor:
        x_raw = np.asarray(x_raw, dtype=np.float32)
        expected_shape = (INPUT_FRAMES, INPUT_CHANNELS, GRID_SIZE, GRID_SIZE)

        if x_raw.shape != expected_shape:
            raise ValueError(f"Expected input shape {expected_shape}, got {x_raw.shape}")

        if not np.isfinite(x_raw).all():
            raise ValueError("Input tensor contains NaN or Inf")

        x_normalized = (x_raw - TRAIN_MEAN[None, :, None, None]) / TRAIN_STD[None, :, None, None]
        tensor = torch.from_numpy(x_normalized.astype(np.float32)).unsqueeze(0)
        return tensor.to(self.device)

    @torch.no_grad()
    def predict(self, x_raw: np.ndarray) -> Dict[str, Any]:
        x = self.prepare_input(x_raw)
        outputs = self.model(x)

        # Rainfall rate in mm/hr
        rainfall = (
            torch.expm1(outputs["rain"])
            .clamp(min=0.0)
            .squeeze(0)
            .cpu()
            .numpy()
        )

        # Rain occurrence probability in [0, 1]
        rain_prob = (
            torch.sigmoid(outputs["rain_probability"])
            .squeeze(0)
            .cpu()
            .numpy()
        )

        forecasts = {}
        for idx, horizon in enumerate(HORIZON_MINUTES):
            forecasts[horizon] = {
                "rain": {
                    "map": rainfall[idx].tolist(),
                    "unit": "mm/hr",
                    "method": "neural_experimental",
                    "description": "Experimental Satellite-Derived Rain Nowcast",
                    "mean": round(float(np.mean(rainfall[idx])), 4),
                    "max": round(float(np.max(rainfall[idx])), 4),
                    "min": round(float(np.min(rainfall[idx])), 4),
                },
                "rain_probability": {
                    "map": rain_prob[idx].tolist(),
                    "unit": "probability",
                    "method": "neural_experimental",
                    "description": "Experimental Rain Occurrence Probability",
                    "mean": round(float(np.mean(rain_prob[idx])), 4),
                    "max": round(float(np.max(rain_prob[idx])), 4),
                    "min": round(float(np.min(rain_prob[idx])), 4),
                }
            }

        return {
            "status": "success",
            "model": "SIH V4 Rainfall Nowcast",
            "device": str(self.device),
            "forecasts": forecasts
        }
