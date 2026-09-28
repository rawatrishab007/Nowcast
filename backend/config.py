import os
import numpy as np
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

class Settings:
    # Service Settings
    MODEL_PATH: str = os.getenv("MODEL_PATH", "./models/sih_v3_best.pth")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # CORS Configuration
    raw_origins = os.getenv(
        "ALLOWED_ORIGINS", 
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    )
    ALLOWED_ORIGINS: list[str] = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    # Model Specification Constants
    MODEL_NAME: str = "SIH V3 ConvLSTM"
    MODEL_VERSION: str = "v3.0.0"
    INPUT_FRAMES: int = 6
    FRAME_INTERVAL_MINUTES: int = 10
    HEIGHT: int = 128
    WIDTH: int = 128
    
    # Channel ordering MUST be strictly preserved
    CHANNELS: list[str] = [
        "B13",
        "t2m",
        "d2m",
        "u10",
        "v10",
        "cape",
        "cin",
        "tp"
    ]
    
    FORECAST_HORIZONS: list[int] = [30, 60, 90, 120]
    TARGET_SEMANTICS: str = "P(future B13 < 235 K)"
    OUTPUT_TYPE: str = "cold-cloud/deep-convection proxy probability"
    
    # Exact Fixed Normalization Means and STDs (float32)
    MEAN: np.ndarray = np.array([
        258.9513,  # B13
        24.3378,   # t2m
        17.6339,   # d2m
        2.7062,    # u10
        1.7265,    # v10
        720.3760,  # cape
        90.9589,   # cin
        0.0002     # tp
    ], dtype=np.float32)

    STD: np.ndarray = np.array([
        12.8962,   # B13
        11.2362,   # t2m
        11.1469,   # d2m
        2.8719,    # u10
        2.7279,    # v10
        851.9800,  # cape
        145.4562,  # cin
        0.0007     # tp
    ], dtype=np.float32)

settings = Settings()
