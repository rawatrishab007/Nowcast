from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

# ==============================================================================
# REQUEST SCHEMAS
# ==============================================================================

class FrameData(BaseModel):
    timestamp: Optional[str] = Field(None, description="ISO timestamp of the frame (separated by 10 min)")
    B13: List[List[float]] = Field(..., description="Himawari-9 AHI Band 13 Brightness Temperature (Kelvin), 128x128 matrix")
    t2m: List[List[float]] = Field(..., description="2m Temperature (°C), 128x128 matrix")
    d2m: List[List[float]] = Field(..., description="2m Dewpoint Temperature (°C), 128x128 matrix")
    u10: List[List[float]] = Field(..., description="10m U-Wind Component (m/s), 128x128 matrix")
    v10: List[List[float]] = Field(..., description="10m V-Wind Component (m/s), 128x128 matrix")
    cape: List[List[float]] = Field(..., description="Convective Available Potential Energy (J/kg), 128x128 matrix")
    cin: List[List[float]] = Field(..., description="Convective Inhibition (J/kg), 128x128 matrix")
    tp: List[List[float]] = Field(..., description="Total Precipitation (ERA5/GFS variable in meters), 128x128 matrix")


class PredictRequest(BaseModel):
    frames: List[FrameData] = Field(
        ...,
        description="Exactly 6 temporal frames spaced by 10 minutes (t-50min to t)",
        min_length=6,
        max_length=6
    )


# ==============================================================================
# UNIFIED MULTI-MODEL SCHEMAS
# ==============================================================================

class GridMetadata(BaseModel):
    lat_min: float = Field(8.0, description="Minimum latitude (degrees North)")
    lat_max: float = Field(38.0, description="Maximum latitude (degrees North)")
    lon_min: float = Field(68.0, description="Minimum longitude (degrees East)")
    lon_max: float = Field(98.0, description="Maximum longitude (degrees East)")
    height: int = Field(128, description="Grid height (rows)")
    width: int = Field(128, description="Grid width (columns)")


class HazardLayerData(BaseModel):
    map: List[List[float]] = Field(..., description="128x128 spatial matrix")
    unit: str = Field(..., description="Unit of map values (e.g. mm/hr, probability [0,1], risk_score [0,1])")
    method: str = Field(..., description="Inference method (neural_experimental, neural_convective_nowcast, physics_informed_proxy, experimental_physics_proxy)")
    description: str = Field(..., description="Scientific interpretation description")
    mean: float = Field(..., description="Domain mean value")
    max: float = Field(..., description="Domain peak value")
    min: float = Field(..., description="Domain minimum value")


class UnifiedHorizonForecast(BaseModel):
    horizon_minutes: int = Field(..., description="Lead time in minutes (30, 60, 90, 120)")
    target_time: Optional[str] = Field(None, description="ISO timestamp of predicted target time")
    rain: HazardLayerData = Field(..., description="V4 Rainfall Intensity (mm/hr)")
    rain_probability: HazardLayerData = Field(..., description="V4 Rain Occurrence Probability [0,1]")
    convective_cloud: HazardLayerData = Field(..., description="V3 Convective Cloud Signal P(B13 < 235K) [0,1]")
    lightning: HazardLayerData = Field(..., description="V1 Lightning Proxy Risk Score [0,1]")
    thunderstorm: HazardLayerData = Field(..., description="V1 Thunderstorm Proxy Risk Score [0,1]")
    hail: HazardLayerData = Field(..., description="V1 Hail Proxy Risk Score [0,1]")
    cloudburst: HazardLayerData = Field(..., description="V1 Cloudburst Proxy Risk Score [0,1]")
    downburst: HazardLayerData = Field(..., description="V1 Downburst Proxy Risk Score [0,1]")


class UnifiedNowcastResponse(BaseModel):
    status: str = Field("success", description="Status string")
    data_mode: str = Field("live", description="Data mode: 'live' or 'demo'")
    base_time: str = Field(..., description="Observation timestamp of latest frame (t0)")
    forecast_horizons: List[int] = Field([30, 60, 90, 120], description="Lead times in minutes")
    grid_metadata: GridMetadata = Field(default_factory=GridMetadata)
    channels: List[str] = Field(["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"])
    models: Dict[str, str] = Field(..., description="Canonical model routing mapping")
    horizons: Dict[str, UnifiedHorizonForecast] = Field(..., description="Forecasts for '30', '60', '90', '120'")
    provenance: Optional[Dict[str, Any]] = Field(None, description="Latency and execution metadata")


# ==============================================================================
# LEGACY / BACKWARD COMPATIBILITY SCHEMAS
# ==============================================================================

class HorizonMap(BaseModel):
    horizon_minutes: int = Field(..., description="Lead time in minutes (+30, +60, +90, +120)")
    target_time: Optional[str] = Field(None, description="ISO timestamp of the predicted target time")
    unit: str = Field("probability", description="Unit of map values (continuous probability 0.0 to 1.0)")
    height: int = Field(128, description="Grid height (rows)")
    width: int = Field(128, description="Grid width (columns)")
    map: List[List[float]] = Field(..., description="2D matrix (128x128) of P(future B13 < 235 K) probabilities")
    mean: float = Field(..., description="Domain mean probability")
    max: float = Field(..., description="Domain peak probability")
    min: float = Field(..., description="Domain minimum probability")


class PredictResponse(BaseModel):
    status: str = Field("success", description="Response status identifier")
    model: str = Field("SIH V3 ConvLSTM", description="Model architecture and name")
    data_mode: str = Field("live", description="Data ingestion mode: 'live' or 'validation_sample'")
    target: str = Field("P(future B13 < 235 K)", description="Exact target semantics predicted by the neural network")
    semantics: str = Field("Convective Cloud Probability", description="Scientific meteorological interpretation")
    unit: str = Field("Probability [0.0 - 1.0]", description="Unit of output probability grids")
    base_time: str = Field(..., description="Observation timestamp of the latest input frame (t0)")
    forecast_horizons: List[int] = Field([30, 60, 90, 120], description="Lead times in minutes")
    grid_metadata: GridMetadata = Field(default_factory=GridMetadata)
    horizons: Dict[str, HorizonMap] = Field(..., description="Forecast maps keyed by minutes ahead: '30', '60', '90', '120'")
    channels: List[str] = Field(["B13", "t2m", "d2m", "u10", "v10", "cape", "cin", "tp"])
    provenance: Optional[Dict[str, Any]] = Field(None)


class HealthResponse(BaseModel):
    status: str = Field(..., description="'ok' if server is operational, 'error' if model failed")
    model_loaded: bool = Field(..., description="Whether PyTorch checkpoints are loaded and ready")
    device: Optional[str] = Field(None, description="PyTorch computation device (cuda, mps, cpu)")
    models_status: Optional[Dict[str, bool]] = Field(None, description="Status of individual models V1, V3, V4")
    model_name: str = Field("WeatherNow Multi-Model Pipeline (V1, V3, V4)", description="Model identifier")
    checkpoint: str = Field("./models/sih_v3_best.pth", description="Checkpoint path")
    message: Optional[str] = Field(None, description="Diagnostic status message")


class ModelInfoResponse(BaseModel):
    models: Dict[str, Dict[str, Any]]
    input_channels: int
    input_frames: int
    frame_interval_minutes: int
    forecast_horizons: List[int]
    resolution: str
    domain: str
    channels: List[str]


class ErrorResponse(BaseModel):
    status: str = Field("error", description="Error status identifier")
    message: str = Field(..., description="Human-readable explanation of error")
