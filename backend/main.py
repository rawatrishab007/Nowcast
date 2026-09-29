import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings
from model_loader import model_manager
from routes.health import router as health_router
from routes.prediction import router as prediction_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("weathernow.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Loads the SIH V3 ConvLSTM checkpoint once on startup.
    """
    logger.info("Initializing WeatherNow AI Backend Service...")
    logger.info(f"Target Checkpoint: {settings.MODEL_PATH}")
    loaded = model_manager.load_model()
    if loaded:
        logger.info("Ready for nowcasting inference requests.")
    else:
        logger.warning(
            "Model checkpoint missing or unreadable. API will run in advisory mode; "
            "/api/predict will return 503 until checkpoint is provided."
        )
    yield
    logger.info("WeatherNow AI Backend Service shutting down.")


app = FastAPI(
    title="WeatherNow AI — SIH V3 Weather Nowcasting API",
    description=(
        "FastAPI service for the SIH V3 Cold-Cloud / Deep-Convection ConvLSTM Nowcasting Model. "
        "Provides 0–120 minute nowcasting predictions (P(future B13 < 235 K)) across the Indian subcontinent."
    ),
    version=settings.MODEL_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# ==============================================================================
# CORS CONFIGURATION
# ==============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ==============================================================================
# GLOBAL EXCEPTION HANDLERS (Shield Internal Stack Traces)
# ==============================================================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": exc.detail}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_messages = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        error_messages.append(f"{loc}: {msg}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status": "error",
            "message": f"Input validation failed: {'; '.join(error_messages)}"
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception on {request.method} {request.url.path}: {str(exc)}", exc_info=False)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "An unexpected internal server error occurred while processing the request."
        }
    )

# ==============================================================================
# ROUTE INCLUSION
# ==============================================================================
app.include_router(health_router, prefix="/api", tags=["System Health"])
app.include_router(prediction_router, prefix="/api", tags=["Nowcasting Predictions"])

@app.get("/", tags=["Root"])
def root_info():
    return {
        "service": "WeatherNow AI Nowcasting Backend",
        "model": settings.MODEL_NAME,
        "version": settings.MODEL_VERSION,
        "docs": "/docs",
        "health": "/api/health",
        "model_info": "/api/model-info",
        "live_prediction": "/api/predict/live"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False
    )
