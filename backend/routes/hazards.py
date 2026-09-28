import numpy as np
import logging
from typing import Dict, List, Any
from fastapi import APIRouter, HTTPException, status
from config import settings
from schemas import (
    PredictRequest,
    HazardResponse,
    HazardHorizonResult,
    HazardProxyItem,
    ErrorResponse
)
from inference import run_nowcast_inference, ModelNotLoadedError
from utils.preprocessing import PreprocessingError

logger = logging.getLogger("weathernow.routes.hazards")
router = APIRouter()

def compute_proxy_indicators(prob_grid: List[List[float]], horizon_min: int) -> List[HazardProxyItem]:
    """
    Computes derived proxy indices from the cold-cloud/deep-convection probability grid.
    
    IMPORTANT ARCHITECTURAL NOTE:
    These are DERIVED PROXY INDICATORS based on deep-convection proxies (P(B13 < 235 K)).
    They are NOT direct multi-task trained hazard outputs.
    When future dedicated hazard heads are trained, this function can be directly replaced.
    """
    arr = np.array(prob_grid, dtype=np.float32)
    mean_val = float(np.mean(arr))
    max_val = float(np.max(arr))

    def get_severity(score: float) -> str:
        if score > 0.75:
            return "Critical"
        elif score > 0.50:
            return "High"
        elif score > 0.25:
            return "Medium"
        return "Low"

    indicators: List[HazardProxyItem] = [
        HazardProxyItem(
            hazard="Deep Convective Storm",
            proxy_type="derived_proxy",
            confidence=round(mean_val, 4),
            peak_probability=round(max_val, 4),
            severity=get_severity(max_val),
            description="Proxy based on predicted cloud-top cooling (B13 < 235K) over the spatial domain."
        ),
        HazardProxyItem(
            hazard="Lightning Potential Proxy",
            proxy_type="derived_proxy",
            confidence=round(mean_val * 0.85, 4),
            peak_probability=round(max_val * 0.90, 4),
            severity=get_severity(max_val * 0.90),
            description="Proxy indicator derived from deep convective updraft likelihood; not direct lightning detection."
        ),
        HazardProxyItem(
            hazard="Severe Rain Core Proxy",
            proxy_type="derived_proxy",
            confidence=round(mean_val * 0.92, 4),
            peak_probability=round(max_val * 0.95, 4),
            severity=get_severity(max_val * 0.95),
            description="Proxy indicator for intense convective rain core presence from satellite brightness proxy."
        ),
        HazardProxyItem(
            hazard="Convective Wind / Downburst Proxy",
            proxy_type="derived_proxy",
            confidence=round(mean_val * 0.70, 4),
            peak_probability=round(max_val * 0.75, 4),
            severity=get_severity(max_val * 0.75),
            description="Proxy indicator for downdraft generation in severe convection cells; unverified proxy."
        )
    ]

    return indicators


@router.post(
    "/hazards",
    response_model=HazardResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input frames"},
        503: {"model": ErrorResponse, "description": "Model unavailable"},
        500: {"model": ErrorResponse, "description": "Processing error"}
    },
    summary="Compute Convective Hazard Proxy Indicators"
)
def get_hazard_proxies(request: PredictRequest) -> HazardResponse:
    """
    Generates derived early-warning hazard proxy indicators from the nowcast prediction.
    All returned items are clearly designated as derived proxies and not direct verified predictions.
    """
    try:
        frames_dict = [frame.model_dump() for frame in request.frames]
        nowcast_result = run_nowcast_inference(frames_dict)

        horizons_result: Dict[str, HazardHorizonResult] = {}
        for h_key, h_map in nowcast_result.horizons.items():
            h_min = int(h_key)
            indicators = compute_proxy_indicators(h_map.map, h_min)
            horizons_result[h_key] = HazardHorizonResult(indicators=indicators)

        return HazardResponse(
            status="success",
            horizons=horizons_result
        )

    except ModelNotLoadedError as mnle:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(mnle)
        )
    except PreprocessingError as pe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(pe)
        )
    except Exception as e:
        logger.error(f"Hazard proxy calculation failed: {str(e)}", exc_info=False)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate hazard proxy indicators."
        )
