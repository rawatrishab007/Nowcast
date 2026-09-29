import os
import logging
from fastapi import APIRouter, HTTPException, status
from config import settings
from model_loader import model_manager
from schemas import (
    PredictRequest,
    PredictResponse,
    UnifiedNowcastResponse,
    ModelInfoResponse,
    ErrorResponse
)
from inference import run_nowcast_inference, run_unified_nowcast_inference, ModelNotLoadedError
from utils.preprocessing import PreprocessingError

logger = logging.getLogger("weathernow.routes.prediction")
router = APIRouter()

@router.get(
    "/model-info",
    response_model=ModelInfoResponse,
    summary="Get Model Architecture & Channel Specification"
)
def get_model_info() -> ModelInfoResponse:
    """
    Returns exact specifications of the SIH V3 Nowcast ConvLSTM model,
    including the required 8-channel ordering, 6-frame temporal sequence,
    and target probability semantics.
    """
    model = model_manager.get_model()
    param_count = sum(p.numel() for p in model.parameters()) if model is not None else 200996

    return ModelInfoResponse(
        model=settings.MODEL_NAME,
        version=settings.MODEL_VERSION,
        parameter_count=param_count,
        input_channels=len(settings.CHANNELS),
        input_frames=settings.INPUT_FRAMES,
        frame_interval_minutes=settings.FRAME_INTERVAL_MINUTES,
        forecast_horizons=settings.FORECAST_HORIZONS,
        resolution=f"{settings.HEIGHT}x{settings.WIDTH}",
        domain="8°N–38°N, 68°E–98°E",
        target=settings.TARGET_SEMANTICS,
        output_type=settings.OUTPUT_TYPE,
        channels=settings.CHANNELS
    )


@router.post(
    "/predict",
    response_model=PredictResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input dimensions, missing channels, or malformed data"},
        422: {"model": ErrorResponse, "description": "Validation error in request schema"},
        503: {"model": ErrorResponse, "description": "Model weights unavailable on server"},
        500: {"model": ErrorResponse, "description": "Internal inference error"}
    },
    summary="Run SIH V3 Nowcast Inference on 6-frame input"
)
def predict_nowcast(request: PredictRequest) -> PredictResponse:
    """
    Accepts 6 temporal frames of atmospheric data across 8 meteorological channels (128x128),
    applies fixed training normalization, executes SIHV3Nowcast inference, and returns
    continuous cold-cloud/deep-convection proxy probability maps for +30, +60, +90, +120 minutes.
    """
    try:
        frames_dict = [frame.model_dump() for frame in request.frames]
        result = run_nowcast_inference(frames_dict, data_mode="custom_input")
        return result

    except ModelNotLoadedError as mnle:
        logger.warning(f"Inference rejected: {str(mnle)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(mnle)
        )
    except PreprocessingError as pe:
        logger.warning(f"Preprocessing validation error: {str(pe)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(pe)
        )
    except Exception as e:
        logger.error(f"Unexpected inference failure: {str(e)}", exc_info=False)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while executing model inference. Please verify the input tensor dimensions."
        )


@router.get(
    "/predict/demo",
    response_model=PredictResponse,
    summary="Execute Nowcast Inference on Stored Validation Dataset"
)
@router.post(
    "/predict/demo",
    response_model=PredictResponse,
    summary="Execute Nowcast Inference on Stored Validation Dataset"
)
def predict_demo() -> PredictResponse:
    """
    Executes SIHV3Nowcast inference on a stored benchmark validation dataset supplied by the ML team.
    If no stored validation file exists on disk, returns 404 rather than generating fake or synthetic data.
    """
    demo_file_candidates = [
        "./data_cache/validation_sample.npz",
        "./data_cache/sample_input.npz",
        "../ai_ml/data/validation_sample.npz"
    ]
    sample_path = None
    for cand in demo_file_candidates:
        if os.path.exists(cand):
            sample_path = cand
            break

    if not sample_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DEMO_DATA_UNAVAILABLE",
                "message": (
                    "Stored validation dataset is not present on disk. "
                    "In accordance with strict scientific validation rules, no fake/random predictions are generated. "
                    "Please use live operational mode (/api/predict/live) for real-time nowcasting."
                )
            }
        )

    import numpy as np
    data = np.load(sample_path)
    # Expected key: 'frames' or 'input_tensor'
    if "input_tensor" in data:
        raw_tensor = data["input_tensor"]  # (6, 8, 128, 128)
        # Convert to frames
        frames_list = []
        for t in range(6):
            frames_list.append({
                settings.CHANNELS[c]: raw_tensor[t, c].tolist() for c in range(8)
            })
        return run_nowcast_inference(frames_list, data_mode="validation_sample")
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid format in stored validation dataset."
        )


@router.get(
    "/predict/live",
    response_model=PredictResponse,
    summary="Execute Nowcast Inference on Real Operational Atmospheric Data"
)
@router.post(
    "/predict/live",
    response_model=PredictResponse,
    summary="Execute Nowcast Inference on Real Operational Atmospheric Data"
)
def predict_live() -> PredictResponse:
    """
    Executes SIHV3Nowcast model inference on real operational NWP & Satellite observations
    across the Indian subcontinent (8°N–38°N, 68°E–98°E).
    Zero synthetic fallback: failures in external data or alignment return explicit HTTP error codes.
    """
    try:
        from data_providers import live_prediction_service
        return live_prediction_service.predict_live()
    except ModelNotLoadedError as mnle:
        logger.error(f"Live prediction failed: {mnle}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "MODEL_UNAVAILABLE", "message": str(mnle)}
        )
    except PreprocessingError as pe:
        logger.error(f"Live preprocessing error: {pe}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "INVALID_V3_INPUT", "message": str(pe)}
        )
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Live operational prediction failed: {err_msg}")
        
        # Categorize known failure reasons
        if "HIMAWARI_DATA_UNAVAILABLE" in err_msg:
            status_code = status.HTTP_502_BAD_GATEWAY
            error_code = "HIMAWARI_DATA_UNAVAILABLE"
        elif "GFS_DATA_UNAVAILABLE" in err_msg:
            status_code = status.HTTP_502_BAD_GATEWAY
            error_code = "GFS_DATA_UNAVAILABLE"
        elif "TEMPORAL_ALIGNMENT_FAILED" in err_msg:
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            error_code = "TEMPORAL_ALIGNMENT_FAILED"
        elif "MODEL_UNAVAILABLE" in err_msg:
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            error_code = "MODEL_UNAVAILABLE"
        elif "INVALID_V3_INPUT" in err_msg:
            status_code = status.HTTP_400_BAD_REQUEST
            error_code = "INVALID_V3_INPUT"
        else:
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            error_code = "INFERENCE_FAILED"

        raise HTTPException(
            status_code=status_code,
            detail={"error_code": error_code, "message": err_msg}
        )


@router.get(
    "/v1/nowcast",
    response_model=UnifiedNowcastResponse,
    summary="Unified Multi-Model Nowcasting (V1, V3, V4) on Real Operational Data"
)
@router.post(
    "/v1/nowcast",
    response_model=UnifiedNowcastResponse,
    summary="Unified Multi-Model Nowcasting (V1, V3, V4) on Real Operational Data"
)
@router.get(
    "/nowcast",
    response_model=UnifiedNowcastResponse,
    summary="Unified Multi-Model Nowcasting Alias"
)
@router.post(
    "/nowcast",
    response_model=UnifiedNowcastResponse,
    summary="Unified Multi-Model Nowcasting Alias"
)
def predict_unified_live() -> UnifiedNowcastResponse:
    """
    Executes unified multi-model nowcasting:
      - V4: Rainfall Rate (mm/hr) & Occurrence Probability [0,1]
      - V3: Convective Cloud Signal P(B13 < 235 K) [0,1]
      - V1: Physics-Informed Severe Weather Risk Scores (Lightning, Thunderstorm, Hail, Cloudburst, Downburst)
    """
    try:
        from data_providers import live_prediction_service
        return live_prediction_service.predict_unified_live()
    except ModelNotLoadedError as mnle:
        logger.error(f"Unified live prediction failed: {mnle}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "MODEL_UNAVAILABLE", "message": str(mnle)}
        )
    except PreprocessingError as pe:
        logger.error(f"Unified live preprocessing error: {pe}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "INVALID_INPUT", "message": str(pe)}
        )
    except Exception as e:
        err_msg = str(e)
        logger.error(f"Unified live nowcast failed: {err_msg}")
        if "HIMAWARI_DATA_UNAVAILABLE" in err_msg:
            status_code = status.HTTP_502_BAD_GATEWAY
            error_code = "HIMAWARI_DATA_UNAVAILABLE"
        elif "GFS_DATA_UNAVAILABLE" in err_msg:
            status_code = status.HTTP_502_BAD_GATEWAY
            error_code = "GFS_DATA_UNAVAILABLE"
        elif "TEMPORAL_ALIGNMENT_FAILED" in err_msg:
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            error_code = "TEMPORAL_ALIGNMENT_FAILED"
        elif "MODEL_UNAVAILABLE" in err_msg:
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            error_code = "MODEL_UNAVAILABLE"
        elif "INVALID_V3_INPUT" in err_msg:
            status_code = status.HTTP_400_BAD_REQUEST
            error_code = "INVALID_V3_INPUT"
        else:
            status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            error_code = "INFERENCE_FAILED"

        raise HTTPException(
            status_code=status_code,
            detail={"error_code": error_code, "message": err_msg}
        )

