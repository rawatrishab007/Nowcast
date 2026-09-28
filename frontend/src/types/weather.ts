// ============================================================
// WeatherNow AI — Centralized TypeScript Domain Types
// ============================================================

export type Page =
  | 'dashboard'
  | 'nowcast'
  | 'weather-map'
  | 'history'
  | 'alerts'
  | 'model-insights'
  | 'settings'
  | 'reports';

export interface WeatherLocation {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  elevation: number;
}

export type WeatherCondition =
  | 'Clear'
  | 'Partly Cloudy'
  | 'Cloudy'
  | 'Light Rain'
  | 'Moderate Rain'
  | 'Heavy Rain'
  | 'Thunderstorm'
  | 'Fog'
  | 'Haze';

export interface CurrentWeather {
  locationId: string;
  timestamp: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  windDirection: string;
  condition: WeatherCondition;
  visibility: number;
  pressure: number;
  dewPoint: number;
  uvIndex: number;
}

// Historical observation point (-60m, -45m, -30m, -15m, NOW)
export interface WeatherObservation {
  minutesAgo: number;
  label: string; // e.g. "-60 min", "Now"
  timestamp: string;
  rainfall: number; // mm/hr
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // km/h
  pressure: number; // hPa
  condition: WeatherCondition;
}

// Model prediction step (NOW, +15m, +30m, +45m, +60m, +90m, +120m)
export interface WeatherPredictionStep {
  minutesAhead: number; // 0 = now, 15, 30, 45, 60, 90, 120
  label: string; // "Now", "+15 min", etc.
  rainfall: number; // mm/hr (predicted)
  lowerBound: number; // lower confidence bound
  upperBound: number; // upper confidence bound
  confidence: number; // 0–100 %
  temperature: number; // °C
  windSpeed: number; // km/h
  humidity: number; // %
  condition: WeatherCondition;
}

// Complete nowcast payload combining separate historical observations & model predictions
export interface NowcastPrediction {
  locationId: string;
  modelRunTime: string;
  predictionHorizonMin: number;
  observations: WeatherObservation[]; // Past observed data
  predictions: WeatherPredictionStep[]; // Future predicted data
}

export interface WeatherHistoryPoint {
  timestamp: string;
  time: string;
  rainfall: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
}

export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type AlertStatus = 'Active' | 'Resolved' | 'Monitoring';

export interface WeatherAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  locationId: string;
  locationName: string;
  timestamp: string;
  updatedAt: string;
  predictionHorizon: string;
  status: AlertStatus;
  icon: string;
  parameterTriggered: string;
}

export interface ModelInsights {
  modelName: string;
  modelVersion: string;
  status: 'Active' | 'Idle' | 'Error';
  predictionHorizonMin: number;
  lastInferenceTime: string;
  inferenceLatencyMs: number;
  averageConfidence: number;
  observationsUsed: number;
  inputDataTimestamp: string;
  dataFreshnessMin: number;
  radarDataAvailable: boolean;
  satelliteDataAvailable: boolean;
  groundStationCount: number;
}

export interface WeatherMapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rainfall: number;
  intensity: 'None' | 'Light' | 'Moderate' | 'Heavy' | 'Extreme';
  temperature: number;
  windSpeed: number;
  condition: WeatherCondition;
  alertLevel: AlertSeverity | 'None';
}
