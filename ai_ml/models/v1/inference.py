from pathlib import Path

import numpy as np
import torch

from model import SIHMultiHazardNowcast
from physics import calculate_physics_hazards


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

HORIZON_MINUTES = [
    30,
    60,
    90,
    120,
]

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


MODEL_PATH = (
    Path(__file__).resolve().parent
    / "sih_multihazard_v1_best.pth"
)


class MultiHazardInference:

    def __init__(self):

        self.device = DEVICE

        self.model = SIHMultiHazardNowcast(
            in_channels=8,
            hidden_channels=32,
            horizons=4,
        )

        checkpoint = torch.load(
            MODEL_PATH,
            map_location=self.device,
        )

        self.model.load_state_dict(
            checkpoint
        )

        self.model.to(self.device)
        self.model.eval()

    def prepare_input(self, x_raw):

        x_raw = np.asarray(
            x_raw,
            dtype=np.float32,
        )

        expected_shape = (
            INPUT_FRAMES,
            INPUT_CHANNELS,
            GRID_SIZE,
            GRID_SIZE,
        )

        if x_raw.shape != expected_shape:

            raise ValueError(
                f"Expected input shape "
                f"{expected_shape}, "
                f"got {x_raw.shape}"
            )

        if not np.isfinite(x_raw).all():

            raise ValueError(
                "Input contains NaN or Inf"
            )

        x_normalized = (
            x_raw
            - TRAIN_MEAN[
                None,
                :,
                None,
                None,
            ]
        ) / (
            TRAIN_STD[
                None,
                :,
                None,
                None,
            ]
        )

        x = torch.from_numpy(
            x_normalized.astype(
                np.float32
            )
        )

        x = x.unsqueeze(0)

        return x.to(self.device)

    @torch.no_grad()
    def predict(self, x_raw):

        x = self.prepare_input(
            x_raw
        )

        outputs = self.model(x)

        rainfall = (
            torch.expm1(
                outputs["rain"]
            )
            .clamp(min=0.0)
            .squeeze(0)
            .cpu()
            .numpy()
        )

        rain_probability = (
            torch.sigmoid(
                outputs[
                    "rain_probability"
                ]
            )
            .squeeze(0)
            .cpu()
            .numpy()
        )

        predictions = {}

        for index, minutes in enumerate(
            HORIZON_MINUTES
        ):

            predictions[
                minutes
            ] = {
                "rain": {
                    "map": rainfall[index],
                    "unit": "mm/hr",
                    "method": (
                        "neural_experimental"
                    ),
                },

                "rain_probability": {
                    "map": rain_probability[index],
                    "unit": "risk_probability",
                    "method": (
                        "neural_experimental"
                    ),
                },
            }

        physics = (
            calculate_physics_hazards(
                x_raw[-1]
            )
        )

        for minutes in HORIZON_MINUTES:

            predictions[
                minutes
            ].update({

                "lightning": {
                    "map": physics[
                        "lightning"
                    ],
                    "unit": "risk_score",
                    "method": (
                        "physics_informed_proxy"
                    ),
                },

                "thunderstorm": {
                    "map": physics[
                        "thunderstorm"
                    ],
                    "unit": "risk_score",
                    "method": (
                        "physics_informed_proxy"
                    ),
                },

                "hail": {
                    "map": physics[
                        "hail"
                    ],
                    "unit": "risk_score",
                    "method": (
                        "physics_informed_proxy"
                    ),
                },

                "cloudburst": {
                    "map": physics[
                        "cloudburst"
                    ],
                    "unit": "risk_score",
                    "method": (
                        "experimental_physics_proxy"
                    ),
                },

                "downburst": {
                    "map": physics[
                        "downburst"
                    ],
                    "unit": "risk_score",
                    "method": (
                        "physics_informed_proxy"
                    ),
                },

            })

        return {
            "status": "success",
            "model": "SIH Multi-Hazard V1",
            "device": str(self.device),
            "input_shape": list(
                x.shape
            ),
            "grid": {
                "height": 128,
                "width": 128,
                "lat_min": 8.0,
                "lat_max": 38.0,
                "lon_min": 68.0,
                "lon_max": 98.0,
            },
            "channels": CHANNELS,
            "horizons_minutes": (
                HORIZON_MINUTES
            ),
            "forecasts": predictions,
        }
