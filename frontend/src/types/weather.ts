// ============================================================
// WeatherNow AI / SIH26084 — Canonical Multi-Model Type Definitions
// V4 Rainfall, V3 Convective Cloud, V1 Severe Weather Proxies
// ============================================================

export type HazardType =
  | 'rain'
  | 'rain_probability'
  | 'convective_cloud'
  | 'lightning'
  | 'thunderstorm'
  | 'hail'
  | 'cloudburst'
  | 'downburst';

export interface GridMetadata {
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  height: number;
  width: number;
}

export interface HazardLayerData {
  map: number[][]; // 128x128 grid
  unit: string;
  method: string;
  description?: string;
  mean?: number;
  max?: number;
  min?: number;
}

export interface UnifiedHorizonForecast {
  horizon_minutes: number;
  target_time?: string;
  rain: HazardLayerData;
  rain_probability: HazardLayerData;
  convective_cloud: HazardLayerData;
  lightning: HazardLayerData;
  thunderstorm: HazardLayerData;
  hail: HazardLayerData;
  cloudburst: HazardLayerData;
  downburst: HazardLayerData;
}

export interface UnifiedNowcastResponse {
  status: string;
  data_mode: 'live' | 'validation_sample' | 'custom_input';
  base_time: string;
  forecast_horizons: number[];
  grid_metadata: GridMetadata;
  channels: string[];
  models: {
    rain: string;
    convective_cloud: string;
    hazards: string;
  };
  horizons: Record<string, UnifiedHorizonForecast>; // '30', '60', '90', '120'
  provenance?: {
    data_source?: string;
    synthetic_data_used?: boolean;
    base_time?: string;
    target_times?: Record<string, string>;
    observation_cadence?: string;
    frame_timestamps?: string[];
    channel_order?: string[];
    grid_dimensions?: { height: number; width: number; channels: number; frames: number };
    atmospheric_observations?: {
      domain_summary?: Record<string, any>;
      [key: string]: any;
    };
    performance?: {
      acquisition_latency_ms?: number;
      normalization_latency_ms?: number;
      inference_latency_ms?: number;
      total_latency_ms?: number;
      device?: string;
    };
    models?: Record<string, string>;
    [key: string]: any;
  };
}

// Legacy V3 response support for backward compatibility
export interface HorizonMap {
  horizon_minutes: number;
  target_time?: string;
  unit: string;
  height: number;
  width: number;
  map: number[][];
  mean: number;
  max: number;
  min: number;
}

export interface PredictResponse {
  status: string;
  model: string;
  data_mode: 'live' | 'validation_sample' | 'custom_input';
  target: string;
  semantics: string;
  unit: string;
  base_time: string;
  forecast_horizons: number[];
  grid_metadata: GridMetadata;
  horizons: Record<string, HorizonMap>;
  channels: string[];
  provenance?: Record<string, any>;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  device?: string;
  model_name?: string;
  checkpoint?: string;
  message?: string;
  models_status?: Record<string, boolean>;
}

export interface ModelInfoResponse {
  model: string;
  version: string;
  parameter_count: number;
  input_channels: number;
  input_frames: number;
  frame_interval_minutes: number;
  forecast_horizons: number[];
  resolution: string;
  domain: string;
  target: string;
  output_type: string;
  channels: string[];
}

export interface WeatherLocation {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  elevation?: number;
  isCustom?: boolean;
}
