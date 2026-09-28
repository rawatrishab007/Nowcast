import logging
from fastapi import APIRouter, HTTPException, status
from config import settings
from schemas import (
    PredictRequest,
    PredictResponse,
    ModelInfoResponse,
    ErrorResponse
)
from inference import run_nowcast_inference, ModelNotLoadedError
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
    return ModelInfoResponse(
        model=settings.MODEL_NAME,
        version=settings.MODEL_VERSION,
        input_channels=len(settings.CHANNELS),
        input_frames=settings.INPUT_FRAMES,
        frame_interval_minutes=settings.FRAME_INTERVAL_MINUTES,
        forecast_horizons=settings.FORECAST_HORIZONS,
        resolution=f"{settings.HEIGHT}x{settings.WIDTH}",
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
    summary="Run SIH V3 Nowcast Inference"
)
def predict_nowcast(request: PredictRequest) -> PredictResponse:
    """
    Accepts 6 temporal frames of atmospheric data across 8 meteorological channels (128x128),
    applies fixed training normalization, executes SIHV3Nowcast inference, and returns
    continuous cold-cloud/deep-convection proxy probability maps for +30, +60, +90, +120 minutes.
    """
    try:
        # Convert Pydantic frame models into dictionaries for tensor constructor
        frames_dict = [frame.model_dump() for frame in request.frames]
        result = run_nowcast_inference(frames_dict)
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
