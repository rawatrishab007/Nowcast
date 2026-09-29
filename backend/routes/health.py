from fastapi import APIRouter, status, Response
from schemas import HealthResponse
from model_loader import model_manager
from config import settings

router = APIRouter()

@router.get("/health", response_model=HealthResponse, summary="Service & Model Health Check")
def get_health(response: Response) -> HealthResponse:
    """
    Returns the operational status of the backend API and checks whether
    the SIH V3 Nowcast model weights are loaded and ready for inference.
    """
    if model_manager.is_loaded():
        return HealthResponse(
            status="ok",
            model_loaded=True,
            device=str(model_manager.get_device()),
            model_name=settings.MODEL_NAME,
            checkpoint=settings.MODEL_PATH,
            message="Model loaded and operational."
        )
    else:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(
            status="error",
            model_loaded=False,
            device=str(model_manager.get_device()),
            model_name=settings.MODEL_NAME,
            checkpoint=settings.MODEL_PATH,
            message=model_manager.load_error or "Model weights not loaded."
        )
