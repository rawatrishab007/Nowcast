from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

# ==============================================================================
# REQUEST SCHEMAS
# ==============================================================================

class FrameData(BaseModel):
    timestamp: Optional[str] = Field(None, description="ISO timestamp of the frame (separated by 10 min)")
    B13: List[List[float]] = Field(..., description="Brightness Temperature (Kelvin), 128x128 matrix")
    t2m: List[List[float]] = Field(..., description="2m Temperature (°C), 128x128 matrix")
    d2m: List[List[float]] = Field(..., description="2m Dewpoint Temperature (°C), 128x128 matrix")
    u10: List[List[float]] = Field(..., description="10m U-Wind Component (m/s), 128x128 matrix")
    v10: List[List[float]] = Field(..., description="10m V-Wind Component (m/s), 128x128 matrix")
    cape: List[List[float]] = Field(..., description="Convective Available Potential Energy (J/kg), 128x128 matrix")
    cin: List[List[float]] = Field(..., description="Convective Inhibition (J/kg), 128x128 matrix")
    tp: List[List[float]] = Field(..., description="Total Precipitation (ERA5 variable), 128x128 matrix")


class PredictRequest(BaseModel):
    frames: List[FrameData] = Field(
        ...,
        description="Exactly 6 temporal frames spaced by 10 minutes (t-50min to t)",
        min_length=6,
        max_length=6
    )


# ==============================================================================
# RESPONSE SCHEMAS
# ==============================================================================

class HorizonMap(BaseModel):
    unit: str = Field("probability", description="Unit of the map values (probability 0 to 1)")
    height: int = Field(128, description="Grid height (rows)")
    width: int = Field(128, description="Grid width (columns)")
    map: List[List[float]] = Field(..., description="2D matrix of cold-cloud/deep-convection proxy probabilities")


class PredictResponse(BaseModel):
    status: str = Field("success", description="Status string")
    model: str = Field("SIH V3", description="Model identifier")
    target: str = Field("P(future B13 < 235 K)", description="Target semantics")
    semantics: str = Field(
        "cold-cloud/deep-convection proxy probability",
        description="Scientific interpretation of the output probabilities"
    )
    horizons: Dict[str, HorizonMap] = Field(
        ...,
        description="Forecast maps keyed by minutes ahead: '30', '60', '90', '120'"
    )


class HealthResponse(BaseModel):
    status: str = Field(..., description="'ok' if server is operational, 'error' if model failed")
    model_loaded: bool = Field(..., description="Whether the PyTorch checkpoint is loaded and ready")
    device: Optional[str] = Field(None, description="PyTorch computation device (cuda, mps, cpu)")
    message: Optional[str] = Field(None, description="Diagnostic or status message")


class ModelInfoResponse(BaseModel):
    model: str
    version: str
    input_channels: int
    input_frames: int
    frame_interval_minutes: int
    forecast_horizons: List[int]
    resolution: str
    target: str
    output_type: str
    channels: List[str]


class HazardProxyItem(BaseModel):
    hazard: str = Field(..., description="Hazard category name")
    proxy_type: str = Field("derived_proxy", description="Explicit designation as derived proxy indicator")
    confidence: float = Field(..., description="Average proxy probability across region of interest (0-1)")
    peak_probability: float = Field(..., description="Peak proxy probability in grid (0-1)")
    severity: str = Field(..., description="'Low', 'Medium', 'High', 'Critical'")
    description: str = Field(..., description="Scientific interpretation note")


class HazardHorizonResult(BaseModel):
    indicators: List[HazardProxyItem]


class HazardResponse(BaseModel):
    status: str = Field("success")
    disclaimer: str = Field(
        "HAZARD PROXY INDICATORS ONLY: The V3 model directly predicts P(future B13 < 235 K) "
        "(cold-cloud / deep-convection proxy). The values below are derived proxy risk indices "
        "and NOT direct verified hazard predictions."
    )
    horizons: Dict[str, HazardHorizonResult]


class ErrorResponse(BaseModel):
    status: str = Field("error", description="Error status identifier")
    message: str = Field(..., description="Human-readable explanation of error")
