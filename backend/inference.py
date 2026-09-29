import threading
import torch
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from config import settings
from model_loader import model_manager
from physics import calculate_physics_hazards
from utils.preprocessing import prepare_input_tensor, PreprocessingError
from schemas import (
    UnifiedNowcastResponse,
    UnifiedHorizonForecast,
    HazardLayerData,
    GridMetadata,
    PredictResponse,
    HorizonMap,
)

_inference_lock = threading.Lock()

# Exact Training Normalization Constants for V1 & V4
V1_V4_MEAN = np.array([
    258.78702,
    24.27609,
    17.63431,
    2.67183,
    1.71813,
    708.90601,
    91.13150,
    0.00023,
], dtype=np.float32)

V1_V4_STD = np.array([
    12.77990,
    11.26621,
    11.18628,
    2.89772,
    2.72003,
    846.71869,
    146.23935,
    0.00073,
], dtype=np.float32)

# Exact Training Normalization Constants for V3
V3_MEAN = np.array([
    258.9513,
    24.3378,
    17.6339,
    2.7062,
    1.7265,
    720.3760,
    90.9589,
    0.0002,
], dtype=np.float32)

V3_STD = np.array([
    12.8962,
    11.2362,
    11.1469,
    2.8719,
    2.7279,
    851.9800,
    145.4562,
    0.0007,
], dtype=np.float32)


class ModelNotLoadedError(RuntimeError):
    pass


def run_unified_nowcast_inference(
    physical_tensor: np.ndarray,
    data_mode: str = "live",
    base_time_str: Optional[str] = None,
    provenance_extra: Optional[Dict[str, Any]] = None
) -> UnifiedNowcastResponse:
    """
    Executes the canonical multi-model nowcasting pipeline across V1, V3, and V4:
      - V4: Rainfall Rate (mm/hr) & Rain Occurrence Probability [0,1]
      - V3: Convective Cloud Signal P(B13 < 235 K) [0,1]
      - V1: Severe Weather Physics-Informed Proxies (Lightning, Thunderstorm, Hail, Cloudburst, Downburst)
    """
    if not model_manager.is_loaded():
        raise ModelNotLoadedError("Neural models not loaded. Verify checkpoints at startup.")

    model_v3 = model_manager.get_model_v3()
    model_v4 = model_manager.get_model_v4()
    device = model_manager.get_device()

    if model_v3 is None or model_v4 is None:
        raise ModelNotLoadedError("Required models (V3 or V4) failed to initialize.")

    if not base_time_str:
        base_time_str = datetime.now(timezone.utc).isoformat()

    try:
        base_dt = datetime.fromisoformat(base_time_str.replace("Z", "+00:00"))
    except Exception:
        base_dt = datetime.now(timezone.utc)

    with _inference_lock:
        # 1. Normalize for V3
        norm_v3 = (physical_tensor - V3_MEAN[None, :, None, None]) / V3_STD[None, :, None, None]
        tensor_v3 = torch.from_numpy(norm_v3.astype(np.float32)).unsqueeze(0).to(device)

        # 2. Normalize for V4
        norm_v4 = (physical_tensor - V1_V4_MEAN[None, :, None, None]) / V1_V4_STD[None, :, None, None]
        tensor_v4 = torch.from_numpy(norm_v4.astype(np.float32)).unsqueeze(0).to(device)

        # 3. Model Forward Passes under torch.no_grad()
        with torch.no_grad():
            # V3 Convective Cloud
            logits_v3 = model_v3(tensor_v3)
            prob_v3 = torch.sigmoid(logits_v3).squeeze(0).cpu().numpy().astype(np.float32)

            # V4 Rainfall
            out_v4 = model_v4(tensor_v4)
            rain_rate_v4 = torch.expm1(out_v4["rain"]).clamp(min=0.0).squeeze(0).cpu().numpy().astype(np.float32)
            rain_prob_v4 = torch.sigmoid(out_v4["rain_probability"]).squeeze(0).cpu().numpy().astype(np.float32)

        # 4. V1 Physics Hazard Proxies from latest atmospheric frame (t0)
        physics_proxies = calculate_physics_hazards(physical_tensor[-1])

    # 5. Assemble unified forecasts across all 4 horizons
    horizons_dict: Dict[str, UnifiedHorizonForecast] = {}
    for idx, horizon_min in enumerate(settings.FORECAST_HORIZONS):
        h_key = str(horizon_min)
        target_iso = (base_dt + timedelta(minutes=horizon_min)).isoformat()

        # Extract horizon slices
        rain_slice = rain_rate_v4[idx]
        rain_prob_slice = rain_prob_v4[idx]
        v3_slice = prob_v3[idx]
        lightning_slice = physics_proxies["lightning"]
        thunderstorm_slice = physics_proxies["thunderstorm"]
        hail_slice = physics_proxies["hail"]
        cloudburst_slice = physics_proxies["cloudburst"]
        downburst_slice = physics_proxies["downburst"]

        horizons_dict[h_key] = UnifiedHorizonForecast(
            horizon_minutes=horizon_min,
            target_time=target_iso,
            rain=HazardLayerData(
                map=rain_slice.tolist(),
                unit="mm/hr",
                method="neural_experimental",
                description="Experimental Satellite-Derived Rain Nowcast",
                mean=round(float(np.mean(rain_slice)), 4),
                max=round(float(np.max(rain_slice)), 4),
                min=round(float(np.min(rain_slice)), 4),
            ),
            rain_probability=HazardLayerData(
                map=rain_prob_slice.tolist(),
                unit="probability [0,1]",
                method="neural_experimental",
                description="Experimental Rain Occurrence Probability",
                mean=round(float(np.mean(rain_prob_slice)), 4),
                max=round(float(np.max(rain_prob_slice)), 4),
                min=round(float(np.min(rain_prob_slice)), 4),
            ),
            convective_cloud=HazardLayerData(
                map=v3_slice.tolist(),
                unit="probability [0,1]",
                method="neural_convective_nowcast",
                description="Neural Cold-Cloud Convection Signal P(B13 < 235K)",
                mean=round(float(np.mean(v3_slice)), 4),
                max=round(float(np.max(v3_slice)), 4),
                min=round(float(np.min(v3_slice)), 4),
            ),
            lightning=HazardLayerData(
                map=lightning_slice.tolist(),
                unit="risk_score [0,1]",
                method="physics_informed_proxy",
                description="Physics-Informed Proxy Risk Score",
                mean=round(float(np.mean(lightning_slice)), 4),
                max=round(float(np.max(lightning_slice)), 4),
                min=round(float(np.min(lightning_slice)), 4),
            ),
            thunderstorm=HazardLayerData(
                map=thunderstorm_slice.tolist(),
                unit="risk_score [0,1]",
                method="physics_informed_proxy",
                description="Physics-Informed Proxy Risk Score",
                mean=round(float(np.mean(thunderstorm_slice)), 4),
                max=round(float(np.max(thunderstorm_slice)), 4),
                min=round(float(np.min(thunderstorm_slice)), 4),
            ),
            hail=HazardLayerData(
                map=hail_slice.tolist(),
                unit="risk_score [0,1]",
                method="physics_informed_proxy",
                description="Physics-Informed Proxy Risk Score",
                mean=round(float(np.mean(hail_slice)), 4),
                max=round(float(np.max(hail_slice)), 4),
                min=round(float(np.min(hail_slice)), 4),
            ),
            cloudburst=HazardLayerData(
                map=cloudburst_slice.tolist(),
                unit="risk_score [0,1]",
                method="experimental_physics_proxy",
                description="Experimental Physics-Informed Proxy Risk Score",
                mean=round(float(np.mean(cloudburst_slice)), 4),
                max=round(float(np.max(cloudburst_slice)), 4),
                min=round(float(np.min(cloudburst_slice)), 4),
            ),
            downburst=HazardLayerData(
                map=downburst_slice.tolist(),
                unit="risk_score [0,1]",
                method="physics_informed_proxy",
                description="Physics-Informed Proxy Risk Score",
                mean=round(float(np.mean(downburst_slice)), 4),
                max=round(float(np.max(downburst_slice)), 4),
                min=round(float(np.min(downburst_slice)), 4),
            ),
        )

    prov = {
        "device": str(device),
        "models": {
            "v4_rainfall": "SIHV4RainfallNowcast (93,208 params)",
            "v3_convective_cloud": "SIHV3Nowcast (200,996 params)",
            "v1_hazard_proxies": "V1 Physics-Informed Proxy Engine",
        }
    }
    if provenance_extra:
        prov.update(provenance_extra)

    return UnifiedNowcastResponse(
        status="success",
        data_mode=data_mode,
        base_time=base_time_str,
        forecast_horizons=settings.FORECAST_HORIZONS,
        grid_metadata=GridMetadata(
            lat_min=8.0,
            lat_max=38.0,
            lon_min=68.0,
            lon_max=98.0,
            height=128,
            width=128,
        ),
        channels=settings.CHANNELS,
        models={
            "rain": "SIHV4RainfallNowcast (V4)",
            "convective_cloud": "SIHV3Nowcast (V3)",
            "hazards": "V1 Physics-Informed Proxy Engine",
        },
        horizons=horizons_dict,
        provenance=prov,
    )


def run_nowcast_inference(
    frames_data: List[Dict[str, Any]],
    data_mode: str = "custom_input",
    base_time_str: Optional[str] = None
) -> PredictResponse:
    """
    Legacy V3 inference runner for backward compatibility.
    """
    if not model_manager.is_loaded():
        raise ModelNotLoadedError("Model checkpoints not loaded.")

    model = model_manager.get_model_v3()
    device = model_manager.get_device()

    with _inference_lock:
        input_tensor = prepare_input_tensor(frames_data, device)
        with torch.no_grad():
            logits = model(input_tensor)
            probabilities = torch.sigmoid(logits)
        prob_np = probabilities.squeeze(0).cpu().numpy().astype(np.float32)

    if not base_time_str:
        if frames_data and len(frames_data) > 0 and frames_data[-1].get("timestamp"):
            base_time_str = str(frames_data[-1]["timestamp"])
        else:
            base_time_str = datetime.now(timezone.utc).isoformat()

    try:
        base_dt = datetime.fromisoformat(base_time_str.replace("Z", "+00:00"))
    except Exception:
        base_dt = datetime.now(timezone.utc)

    horizons_dict: Dict[str, HorizonMap] = {}
    for idx, horizon_min in enumerate(settings.FORECAST_HORIZONS):
        h_key = str(horizon_min)
        grid_slice = prob_np[idx]
        target_time_iso = (base_dt + timedelta(minutes=horizon_min)).isoformat()

        horizons_dict[h_key] = HorizonMap(
            horizon_minutes=horizon_min,
            target_time=target_time_iso,
            unit="probability",
            height=settings.HEIGHT,
            width=settings.WIDTH,
            map=grid_slice.tolist(),
            mean=round(float(np.mean(grid_slice)), 4),
            max=round(float(np.max(grid_slice)), 4),
            min=round(float(np.min(grid_slice)), 4),
        )

    return PredictResponse(
        status="success",
        model=settings.MODEL_NAME,
        data_mode=data_mode,
        target=settings.TARGET_SEMANTICS,
        semantics=settings.OUTPUT_TYPE,
        unit="Probability [0.0 - 1.0]",
        base_time=base_time_str,
        forecast_horizons=settings.FORECAST_HORIZONS,
        grid_metadata=GridMetadata(
            lat_min=8.0,
            lat_max=38.0,
            lon_min=68.0,
            lon_max=98.0,
            height=settings.HEIGHT,
            width=settings.WIDTH,
        ),
        horizons=horizons_dict,
        channels=settings.CHANNELS,
        provenance={"device": str(device)},
    )
