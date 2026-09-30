"""
WeatherNow AI — Centralized Rule-Based Alert & Risk Engine Configuration
Defines transparent decision-support indicator thresholds.
STRICT RULE: Decision-support indicators only; not official government warnings.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class AlertThresholds:
    # 1. Rainfall Rate Thresholds (mm/hr) from V4 Neural Nowcast
    RAIN_RATE_MODERATE: float = 5.0      # mm/hr: Moderate Rain
    RAIN_RATE_HEAVY: float = 15.0        # mm/hr: Potential Heavy Rain Indicator
    RAIN_RATE_VERY_HEAVY: float = 30.0   # mm/hr: Potential Torrential Rain Indicator
    RAIN_RATE_EXTREME: float = 50.0      # mm/hr: Potential Extreme Precipitation Indicator

    # 2. Rain Occurrence Probability Thresholds ([0.0 - 1.0]) from V4 Neural Model
    RAIN_PROB_ELEVATED: float = 0.40
    RAIN_PROB_HIGH: float = 0.70

    # 3. Convective Cold-Cloud Signal Thresholds ([0.0 - 1.0]) from V3 ConvLSTM
    CONVECTIVE_CLOUD_MODERATE: float = 0.30
    CONVECTIVE_CLOUD_HIGH: float = 0.60
    CONVECTIVE_CLOUD_VERY_HIGH: float = 0.80

    # 4. Severe Weather Physics-Informed Proxy Risk Scores ([0.0 - 1.0]) from V1 Engine
    LIGHTNING_RISK_ELEVATED: float = 0.35
    LIGHTNING_RISK_HIGH: float = 0.60
    LIGHTNING_RISK_CRITICAL: float = 0.80

    THUNDERSTORM_RISK_ELEVATED: float = 0.35
    THUNDERSTORM_RISK_HIGH: float = 0.60

    HAIL_RISK_ELEVATED: float = 0.35
    HAIL_RISK_HIGH: float = 0.60

    CLOUDBURST_RISK_ELEVATED: float = 0.35
    CLOUDBURST_RISK_HIGH: float = 0.60

    DOWNBURST_RISK_ELEVATED: float = 0.35
    DOWNBURST_RISK_HIGH: float = 0.60


class DecisionSupportAlert(BaseModel):
    id: str
    category: str
    indicator_title: str
    severity_level: str  # 'advisory' | 'elevated' | 'high' | 'critical'
    trigger_rule: str
    description: str
    lead_time_min: int
    source_model: str
    scientific_disclaimer: str = (
        "Decision-support indicator derived from satellite/NWP multi-model inference. "
        "Proxy scores are not calibrated observational probabilities. Not an official warning."
    )


def evaluate_decision_support_alerts(
    forecast_values: Dict[str, float],
    horizon_min: int = 30
) -> List[DecisionSupportAlert]:
    """
    Evaluates rule-based decision-support alerts for a specific coordinate and lead time.
    forecast_values must contain keys:
      'rain', 'rain_probability', 'convective_cloud', 'lightning', 'thunderstorm', 'hail', 'cloudburst', 'downburst'
    """
    alerts: List[DecisionSupportAlert] = []

    rain = forecast_values.get("rain", 0.0)
    rain_prob = forecast_values.get("rain_probability", 0.0)
    conv_cloud = forecast_values.get("convective_cloud", 0.0)
    lightning = forecast_values.get("lightning", 0.0)
    tstorm = forecast_values.get("thunderstorm", 0.0)
    hail = forecast_values.get("hail", 0.0)
    cloudburst = forecast_values.get("cloudburst", 0.0)
    downburst = forecast_values.get("downburst", 0.0)

    # Rule 1: Potential Extreme / Heavy Rain Indicator
    if rain >= AlertThresholds.RAIN_RATE_EXTREME:
        alerts.append(DecisionSupportAlert(
            id=f"rain_extreme_{horizon_min}",
            category="Heavy Rainfall",
            indicator_title="Potential Extreme Precipitation Indicator",
            severity_level="critical",
            trigger_rule=f"V4 Rain Rate >= {AlertThresholds.RAIN_RATE_EXTREME} mm/hr (Observed: {rain:.1f} mm/hr)",
            description=f"Neural nowcasting indicates extreme rainfall rate ({rain:.1f} mm/hr) at +{horizon_min}m.",
            lead_time_min=horizon_min,
            source_model="V4 Rainfall Nowcast (Neural)"
        ))
    elif rain >= AlertThresholds.RAIN_RATE_VERY_HEAVY:
        alerts.append(DecisionSupportAlert(
            id=f"rain_very_heavy_{horizon_min}",
            category="Heavy Rainfall",
            indicator_title="Potential Torrential Rain Indicator",
            severity_level="high",
            trigger_rule=f"V4 Rain Rate >= {AlertThresholds.RAIN_RATE_VERY_HEAVY} mm/hr (Observed: {rain:.1f} mm/hr)",
            description=f"Neural nowcasting indicates very heavy rainfall rate ({rain:.1f} mm/hr) at +{horizon_min}m.",
            lead_time_min=horizon_min,
            source_model="V4 Rainfall Nowcast (Neural)"
        ))
    elif rain >= AlertThresholds.RAIN_RATE_HEAVY:
        alerts.append(DecisionSupportAlert(
            id=f"rain_heavy_{horizon_min}",
            category="Heavy Rainfall",
            indicator_title="Potential Heavy Rain Indicator",
            severity_level="elevated",
            trigger_rule=f"V4 Rain Rate >= {AlertThresholds.RAIN_RATE_HEAVY} mm/hr (Observed: {rain:.1f} mm/hr)",
            description=f"Neural nowcasting indicates heavy rainfall rate ({rain:.1f} mm/hr) at +{horizon_min}m.",
            lead_time_min=horizon_min,
            source_model="V4 Rainfall Nowcast (Neural)"
        ))

    # Rule 2: Potential Convective Activity (V3 Conv Cloud + V1 Lightning Proxy)
    if conv_cloud >= AlertThresholds.CONVECTIVE_CLOUD_HIGH and lightning >= AlertThresholds.LIGHTNING_RISK_ELEVATED:
        severity = "high" if (conv_cloud >= AlertThresholds.CONVECTIVE_CLOUD_VERY_HIGH or lightning >= AlertThresholds.LIGHTNING_RISK_HIGH) else "elevated"
        alerts.append(DecisionSupportAlert(
            id=f"convective_active_{horizon_min}",
            category="Deep Convection",
            indicator_title="Potential Convective Storm Activity Indicator",
            severity_level=severity,
            trigger_rule=f"V3 Convective Signal >= {AlertThresholds.CONVECTIVE_CLOUD_HIGH:.2f} ({conv_cloud:.2f}) AND V1 Lightning Proxy >= {AlertThresholds.LIGHTNING_RISK_ELEVATED:.2f} ({lightning:.2f})",
            description=f"Coupled cold-cloud signal ({conv_cloud*100:.0f}%) and atmospheric instability proxy ({lightning:.2f}) indicate active storm development.",
            lead_time_min=horizon_min,
            source_model="V3 Convection + V1 Physics Proxy"
        ))

    # Rule 3: Elevated Severe Lightning Risk Indicator
    if lightning >= AlertThresholds.LIGHTNING_RISK_CRITICAL:
        alerts.append(DecisionSupportAlert(
            id=f"lightning_critical_{horizon_min}",
            category="Severe Weather",
            indicator_title="Critical Lightning Risk Indicator",
            severity_level="critical",
            trigger_rule=f"V1 Lightning Proxy Score >= {AlertThresholds.LIGHTNING_RISK_CRITICAL:.2f} (Observed: {lightning:.2f})",
            description=f"Thermodynamic profile (CAPE, wind shear, cold cloud) reflects critical charge separation potential.",
            lead_time_min=horizon_min,
            source_model="V1 Physics-Informed Proxy Engine"
        ))
    elif lightning >= AlertThresholds.LIGHTNING_RISK_HIGH:
        alerts.append(DecisionSupportAlert(
            id=f"lightning_high_{horizon_min}",
            category="Severe Weather",
            indicator_title="Elevated Lightning Risk Indicator",
            severity_level="high",
            trigger_rule=f"V1 Lightning Proxy Score >= {AlertThresholds.LIGHTNING_RISK_HIGH:.2f} (Observed: {lightning:.2f})",
            description=f"Atmospheric instability proxy ({lightning:.2f}) indicates elevated lightning potential.",
            lead_time_min=horizon_min,
            source_model="V1 Physics-Informed Proxy Engine"
        ))

    # Rule 4: Elevated Hail Risk Indicator
    if hail >= AlertThresholds.HAIL_RISK_HIGH:
        alerts.append(DecisionSupportAlert(
            id=f"hail_high_{horizon_min}",
            category="Severe Weather",
            indicator_title="Elevated Hail Risk Indicator",
            severity_level="high",
            trigger_rule=f"V1 Hail Proxy Score >= {AlertThresholds.HAIL_RISK_HIGH:.2f} (Observed: {hail:.2f})",
            description=f"Severe updraft and sub-freezing moisture proxies indicate elevated hail potential ({hail:.2f}).",
            lead_time_min=horizon_min,
            source_model="V1 Physics-Informed Proxy Engine"
        ))
    elif hail >= AlertThresholds.HAIL_RISK_ELEVATED:
        alerts.append(DecisionSupportAlert(
            id=f"hail_elevated_{horizon_min}",
            category="Severe Weather",
            indicator_title="Hail Risk Advisory Indicator",
            severity_level="elevated",
            trigger_rule=f"V1 Hail Proxy Score >= {AlertThresholds.HAIL_RISK_ELEVATED:.2f} (Observed: {hail:.2f})",
            description=f"Thermodynamic conditions indicate moderate hail development proxy ({hail:.2f}).",
            lead_time_min=horizon_min,
            source_model="V1 Physics-Informed Proxy Engine"
        ))

    # Rule 5: Potential Localized Heavy Rainfall / Cloudburst Proxy
    if cloudburst >= AlertThresholds.CLOUDBURST_RISK_ELEVATED and rain >= AlertThresholds.RAIN_RATE_MODERATE:
        alerts.append(DecisionSupportAlert(
            id=f"cloudburst_potential_{horizon_min}",
            category="Localized Flash Flooding",
            indicator_title="Potential Localized Heavy Rainfall Indicator",
            severity_level="high" if (cloudburst >= AlertThresholds.CLOUDBURST_RISK_HIGH or rain >= AlertThresholds.RAIN_RATE_HEAVY) else "elevated",
            trigger_rule=f"V1 Cloudburst Proxy >= {AlertThresholds.CLOUDBURST_RISK_ELEVATED:.2f} ({cloudburst:.2f}) AND Rain Rate >= {AlertThresholds.RAIN_RATE_MODERATE:.1f} mm/hr ({rain:.1f} mm/hr)",
            description=f"Extreme moisture flux and orographic instability indicate potential localized rapid precipitation.",
            lead_time_min=horizon_min,
            source_model="V1 Experimental Proxy + V4 Rain"
        ))

    # Rule 6: Downburst / High Wind Gust Proxy
    if downburst >= AlertThresholds.DOWNBURST_RISK_HIGH:
        alerts.append(DecisionSupportAlert(
            id=f"downburst_high_{horizon_min}",
            category="Severe Weather",
            indicator_title="Elevated Downburst / High Wind Risk Indicator",
            severity_level="high",
            trigger_rule=f"V1 Downburst Proxy >= {AlertThresholds.DOWNBURST_RISK_HIGH:.2f} (Observed: {downburst:.2f})",
            description=f"Dry sub-cloud air entrainment and negative buoyancy proxy indicate elevated downburst potential ({downburst:.2f}).",
            lead_time_min=horizon_min,
            source_model="V1 Physics-Informed Proxy Engine"
        ))

    return alerts
