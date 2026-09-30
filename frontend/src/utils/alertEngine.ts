// ============================================================
// WeatherNow AI — Client-Side Rule-Based Alert & Risk Engine
// Consumes genuine multi-model forecast outputs.
// STRICT RULE: Decision-support indicators only; not official warnings.
// ============================================================

import type { DecisionSupportAlert, UnifiedHorizonForecast } from '../types/weather';

export interface PointForecastValues {
  rain: number;
  rain_probability: number;
  convective_cloud: number;
  lightning: number;
  thunderstorm: number;
  hail: number;
  cloudburst: number;
  downburst: number;
}

export const ALERT_THRESHOLDS = {
  RAIN_RATE_MODERATE: 5.0,      // mm/hr
  RAIN_RATE_HEAVY: 15.0,        // mm/hr
  RAIN_RATE_VERY_HEAVY: 30.0,   // mm/hr
  RAIN_RATE_EXTREME: 50.0,      // mm/hr

  CONVECTIVE_CLOUD_MODERATE: 0.30,
  CONVECTIVE_CLOUD_HIGH: 0.60,
  CONVECTIVE_CLOUD_VERY_HIGH: 0.80,

  LIGHTNING_RISK_ELEVATED: 0.35,
  LIGHTNING_RISK_HIGH: 0.60,
  LIGHTNING_RISK_CRITICAL: 0.80,

  THUNDERSTORM_RISK_ELEVATED: 0.35,
  THUNDERSTORM_RISK_HIGH: 0.60,

  HAIL_RISK_ELEVATED: 0.35,
  HAIL_RISK_HIGH: 0.60,

  CLOUDBURST_RISK_ELEVATED: 0.35,
  CLOUDBURST_RISK_HIGH: 0.60,

  DOWNBURST_RISK_ELEVATED: 0.35,
  DOWNBURST_RISK_HIGH: 0.60,
};

export function evaluateDecisionSupportAlerts(
  values: PointForecastValues,
  horizonMin: number = 30
): DecisionSupportAlert[] {
  const alerts: DecisionSupportAlert[] = [];

  const {
    rain = 0,
    convective_cloud: convCloud = 0,
    lightning = 0,
    hail = 0,
    cloudburst = 0,
    downburst = 0,
  } = values;

  // 1. Rain Rate Indicator
  if (rain >= ALERT_THRESHOLDS.RAIN_RATE_EXTREME) {
    alerts.push({
      id: `rain_extreme_${horizonMin}`,
      category: 'Heavy Rainfall',
      indicator_title: 'Potential Extreme Precipitation Indicator',
      severity_level: 'critical',
      trigger_rule: `V4 Rain Rate >= ${ALERT_THRESHOLDS.RAIN_RATE_EXTREME} mm/hr (Observed: ${rain.toFixed(1)} mm/hr)`,
      description: `Neural nowcasting indicates extreme rainfall rate (${rain.toFixed(1)} mm/hr) at +${horizonMin}m.`,
      lead_time_min: horizonMin,
      source_model: 'V4 Rainfall Nowcast (Neural)',
    });
  } else if (rain >= ALERT_THRESHOLDS.RAIN_RATE_VERY_HEAVY) {
    alerts.push({
      id: `rain_very_heavy_${horizonMin}`,
      category: 'Heavy Rainfall',
      indicator_title: 'Potential Torrential Rain Indicator',
      severity_level: 'high',
      trigger_rule: `V4 Rain Rate >= ${ALERT_THRESHOLDS.RAIN_RATE_VERY_HEAVY} mm/hr (Observed: ${rain.toFixed(1)} mm/hr)`,
      description: `Neural nowcasting indicates very heavy rainfall rate (${rain.toFixed(1)} mm/hr) at +${horizonMin}m.`,
      lead_time_min: horizonMin,
      source_model: 'V4 Rainfall Nowcast (Neural)',
    });
  } else if (rain >= ALERT_THRESHOLDS.RAIN_RATE_HEAVY) {
    alerts.push({
      id: `rain_heavy_${horizonMin}`,
      category: 'Heavy Rainfall',
      indicator_title: 'Potential Heavy Rain Indicator',
      severity_level: 'elevated',
      trigger_rule: `V4 Rain Rate >= ${ALERT_THRESHOLDS.RAIN_RATE_HEAVY} mm/hr (Observed: ${rain.toFixed(1)} mm/hr)`,
      description: `Neural nowcasting indicates heavy rainfall rate (${rain.toFixed(1)} mm/hr) at +${horizonMin}m.`,
      lead_time_min: horizonMin,
      source_model: 'V4 Rainfall Nowcast (Neural)',
    });
  }

  // 2. Convective Storm Activity Indicator (V3 Cold Cloud + V1 Lightning Risk)
  if (convCloud >= ALERT_THRESHOLDS.CONVECTIVE_CLOUD_HIGH && lightning >= ALERT_THRESHOLDS.LIGHTNING_RISK_ELEVATED) {
    const isCriticalOrHigh = convCloud >= ALERT_THRESHOLDS.CONVECTIVE_CLOUD_VERY_HIGH || lightning >= ALERT_THRESHOLDS.LIGHTNING_RISK_HIGH;
    alerts.push({
      id: `convective_active_${horizonMin}`,
      category: 'Deep Convection',
      indicator_title: 'Potential Convective Storm Activity Indicator',
      severity_level: isCriticalOrHigh ? 'high' : 'elevated',
      trigger_rule: `V3 Convective Signal >= ${ALERT_THRESHOLDS.CONVECTIVE_CLOUD_HIGH.toFixed(2)} (${convCloud.toFixed(2)}) AND V1 Lightning Risk >= ${ALERT_THRESHOLDS.LIGHTNING_RISK_ELEVATED.toFixed(2)} (${lightning.toFixed(2)})`,
      description: `Coupled cold-cloud signal (${(convCloud * 100).toFixed(0)}%) and instability indicator (${lightning.toFixed(2)}) indicate active storm development.`,
      lead_time_min: horizonMin,
      source_model: 'V3 Convection + V1 Severe Weather',
    });
  }

  // 3. Lightning Risk Indicator
  if (lightning >= ALERT_THRESHOLDS.LIGHTNING_RISK_CRITICAL) {
    alerts.push({
      id: `lightning_critical_${horizonMin}`,
      category: 'Severe Weather',
      indicator_title: 'Critical Lightning Risk Indicator',
      severity_level: 'critical',
      trigger_rule: `V1 Lightning Risk Score >= ${ALERT_THRESHOLDS.LIGHTNING_RISK_CRITICAL.toFixed(2)} (Observed: ${lightning.toFixed(2)})`,
      description: `Thermodynamic profile (CAPE, shear, cold cloud) reflects critical charge separation potential.`,
      lead_time_min: horizonMin,
      source_model: 'V1 Severe Weather',
    });
  } else if (lightning >= ALERT_THRESHOLDS.LIGHTNING_RISK_HIGH) {
    alerts.push({
      id: `lightning_high_${horizonMin}`,
      category: 'Severe Weather',
      indicator_title: 'Elevated Lightning Risk Indicator',
      severity_level: 'high',
      trigger_rule: `V1 Lightning Risk Score >= ${ALERT_THRESHOLDS.LIGHTNING_RISK_HIGH.toFixed(2)} (Observed: ${lightning.toFixed(2)})`,
      description: `Atmospheric instability indicator (${lightning.toFixed(2)}) indicates elevated lightning potential.`,
      lead_time_min: horizonMin,
      source_model: 'V1 Severe Weather',
    });
  }

  // 4. Hail Risk Indicator
  if (hail >= ALERT_THRESHOLDS.HAIL_RISK_HIGH) {
    alerts.push({
      id: `hail_high_${horizonMin}`,
      category: 'Severe Weather',
      indicator_title: 'Elevated Hail Risk Indicator',
      severity_level: 'high',
      trigger_rule: `V1 Hail Risk Score >= ${ALERT_THRESHOLDS.HAIL_RISK_HIGH.toFixed(2)} (Observed: ${hail.toFixed(2)})`,
      description: `Severe updraft and sub-freezing moisture conditions indicate elevated hail potential (${hail.toFixed(2)}).`,
      lead_time_min: horizonMin,
      source_model: 'V1 Severe Weather',
    });
  } else if (hail >= ALERT_THRESHOLDS.HAIL_RISK_ELEVATED) {
    alerts.push({
      id: `hail_elevated_${horizonMin}`,
      category: 'Severe Weather',
      indicator_title: 'Hail Risk Advisory Indicator',
      severity_level: 'elevated',
      trigger_rule: `V1 Hail Risk Score >= ${ALERT_THRESHOLDS.HAIL_RISK_ELEVATED.toFixed(2)} (Observed: ${hail.toFixed(2)})`,
      description: `Thermodynamic conditions indicate moderate hail development risk (${hail.toFixed(2)}).`,
      lead_time_min: horizonMin,
      source_model: 'V1 Severe Weather',
    });
  }

  // 5. Cloudburst / Localized Flash Flood Risk
  if (cloudburst >= ALERT_THRESHOLDS.CLOUDBURST_RISK_ELEVATED && rain >= ALERT_THRESHOLDS.RAIN_RATE_MODERATE) {
    alerts.push({
      id: `cloudburst_potential_${horizonMin}`,
      category: 'Localized Flash Flooding',
      indicator_title: 'Potential Localized Heavy Rainfall Indicator',
      severity_level: (cloudburst >= ALERT_THRESHOLDS.CLOUDBURST_RISK_HIGH || rain >= ALERT_THRESHOLDS.RAIN_RATE_HEAVY) ? 'high' : 'elevated',
      trigger_rule: `V1 Cloudburst Risk >= ${ALERT_THRESHOLDS.CLOUDBURST_RISK_ELEVATED.toFixed(2)} (${cloudburst.toFixed(2)}) AND Rain Rate >= ${ALERT_THRESHOLDS.RAIN_RATE_MODERATE.toFixed(1)} mm/hr (${rain.toFixed(1)} mm/hr)`,
      description: `Extreme moisture flux and orographic instability indicate potential localized rapid precipitation.`,
      lead_time_min: horizonMin,
      source_model: 'V1 Severe Weather + V4 Rain',
    });
  }

  // 6. Downburst / High Wind Risk
  if (downburst >= ALERT_THRESHOLDS.DOWNBURST_RISK_HIGH) {
    alerts.push({
      id: `downburst_high_${horizonMin}`,
      category: 'Severe Weather',
      indicator_title: 'Elevated Downburst / High Wind Risk Indicator',
      severity_level: 'high',
      trigger_rule: `V1 Downburst Risk >= ${ALERT_THRESHOLDS.DOWNBURST_RISK_HIGH.toFixed(2)} (Observed: ${downburst.toFixed(2)})`,
      description: `Dry sub-cloud air entrainment and negative buoyancy indicators reflect elevated downburst potential (${downburst.toFixed(2)}).`,
      lead_time_min: horizonMin,
      source_model: 'V1 Severe Weather',
    });
  }

  return alerts;
}

export function extractPointValuesFromHorizon(
  horizonForecast: UnifiedHorizonForecast | undefined,
  row: number,
  col: number
): PointForecastValues {
  if (!horizonForecast) {
    return {
      rain: 0,
      rain_probability: 0,
      convective_cloud: 0,
      lightning: 0,
      thunderstorm: 0,
      hail: 0,
      cloudburst: 0,
      downburst: 0,
    };
  }

  return {
    rain: horizonForecast.rain?.map?.[row]?.[col] ?? 0,
    rain_probability: horizonForecast.rain_probability?.map?.[row]?.[col] ?? 0,
    convective_cloud: horizonForecast.convective_cloud?.map?.[row]?.[col] ?? 0,
    lightning: horizonForecast.lightning?.map?.[row]?.[col] ?? 0,
    thunderstorm: horizonForecast.thunderstorm?.map?.[row]?.[col] ?? 0,
    hail: horizonForecast.hail?.map?.[row]?.[col] ?? 0,
    cloudburst: horizonForecast.cloudburst?.map?.[row]?.[col] ?? 0,
    downburst: horizonForecast.downburst?.map?.[row]?.[col] ?? 0,
  };
}
