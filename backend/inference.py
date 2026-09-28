import torch
import numpy as np
from typing import Dict, Any, List
from config import settings
from model_loader import model_manager
from utils.preprocessing import prepare_input_tensor, PreprocessingError
from schemas import PredictResponse, HorizonMap

class ModelNotLoadedError(RuntimeError):
    """Raised when an inference request is received but no model checkpoint is loaded."""
    pass


def run_nowcast_inference(frames_data: List[Dict[str, Any]]) -> PredictResponse:
    """
    Executes the full inference pipeline for the SIH V3 Nowcast model:
      1. Verifies model readiness.
      2. Validates and normalizes 6 frames of 8 channels (128x128).
      3. Passes (1, 6, 8, 128, 128) through SIHV3Nowcast.
      4. Applies torch.sigmoid to logits -> continuous probabilities.
      5. Formats horizons (30, 60, 90, 120 min) into 128x128 JSON-compatible lists.
    """
    if not model_manager.is_loaded():
        raise ModelNotLoadedError(
            "Model checkpoint is not loaded. Ensure a valid weights file exists at "
            f"'{settings.MODEL_PATH}' and restart or initialize the service."
        )

    model = model_manager.get_model()
    device = model_manager.get_device()

    # 1. Preprocess & Normalize input: shape -> (1, 6, 8, 128, 128)
    input_tensor = prepare_input_tensor(frames_data, device)

    # 2. Run inference under torch.no_grad()
    with torch.no_grad():
        # Output shape: (1, 4, 128, 128)
        logits = model(input_tensor)
        
        # Apply sigmoid to convert raw logits to probabilities [0.0, 1.0]
        probabilities = torch.sigmoid(logits)

    # 3. Transfer to CPU numpy array: shape -> (4, 128, 128)
    prob_np = probabilities.squeeze(0).cpu().numpy().astype(np.float32)

    # 4. Construct response dictionary for each horizon
    # Horizons: index 0 -> +30m, 1 -> +60m, 2 -> +90m, 3 -> +120m
    horizons_dict: Dict[str, HorizonMap] = {}
    for idx, horizon_min in enumerate(settings.FORECAST_HORIZONS):
        horizon_key = str(horizon_min)
        grid_2d = prob_np[idx].tolist()
        
        horizons_dict[horizon_key] = HorizonMap(
            unit="probability",
            height=settings.HEIGHT,
            width=settings.WIDTH,
            map=grid_2d
        )

    return PredictResponse(
        status="success",
        model=settings.MODEL_NAME,
        target=settings.TARGET_SEMANTICS,
        semantics=settings.OUTPUT_TYPE,
        horizons=horizons_dict
    )
