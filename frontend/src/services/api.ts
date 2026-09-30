// ============================================================
// WeatherNow AI — Centralized API Client Service
// ============================================================

import type {
  PredictResponse,
  UnifiedNowcastResponse,
  HealthResponse,
  PipelineHealthResponse,
  ModelInfoResponse,
} from '../types/weather';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  detail?: any;

  constructor(message: string, statusCode: number = 500, errorCode: string = 'API_ERROR', detail?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.detail = detail;
  }
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      let errorDetail = res.statusText || 'Request failed';
      let errorCode = `HTTP_${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson) {
          if (typeof errJson.detail === 'object' && errJson.detail !== null) {
            errorCode = errJson.detail.error_code || errorCode;
            errorDetail = errJson.detail.message || JSON.stringify(errJson.detail);
          } else if (typeof errJson.detail === 'string') {
            errorDetail = errJson.detail;
          } else if (errJson.message) {
            errorDetail = errJson.message;
          }
        }
      } catch {
        // Response was not JSON
      }
      throw new ApiError(errorDetail, res.status, errorCode);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err?.message || 'Network connection to backend server failed',
      0,
      'NETWORK_ERROR'
    );
  }
}

// 1. Health Check
export async function getHealth(): Promise<HealthResponse> {
  try {
    return await fetchJson<HealthResponse>('/health');
  } catch (err: any) {
    return {
      status: 'error',
      model_loaded: false,
      message: err?.message || 'Backend service unreachable',
    };
  }
}

// 2. Model Architecture & Specifications
export async function getModelInfo(): Promise<ModelInfoResponse> {
  return await fetchJson<ModelInfoResponse>('/model-info');
}

// 3. Unified Multi-Model Nowcasting Prediction
let cachedUnified: UnifiedNowcastResponse | null = null;
let lastUnifiedFetchTime = 0;
let inFlightUnified: Promise<UnifiedNowcastResponse> | null = null;
const CACHE_TTL_MS = 30000; // 30 seconds

export async function getUnifiedNowcast(forceRefresh: boolean = false): Promise<UnifiedNowcastResponse> {
  const now = Date.now();
  if (!forceRefresh && cachedUnified && now - lastUnifiedFetchTime < CACHE_TTL_MS) {
    return cachedUnified;
  }

  if (inFlightUnified) {
    return inFlightUnified;
  }

  inFlightUnified = (async () => {
    try {
      let raw: UnifiedNowcastResponse;
      try {
        raw = await fetchJson<UnifiedNowcastResponse>('/v1/nowcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } catch {
        raw = await fetchJson<UnifiedNowcastResponse>('/v1/nowcast');
      }

      // Validate contract integrity
      if (!raw || raw.status !== 'success' || !raw.horizons) {
        throw new ApiError('Malformed unified prediction payload received from backend', 500, 'INVALID_PAYLOAD');
      }

      for (const h of ['30', '60', '90', '120']) {
        const hData = raw.horizons[h];
        if (!hData || !hData.rain || !Array.isArray(hData.rain.map) || hData.rain.map.length !== 128) {
          throw new ApiError(`Horizon +${h}m does not contain valid 128x128 hazard grids`, 500, 'MALFORMED_GRID');
        }
      }

      cachedUnified = raw;
      lastUnifiedFetchTime = Date.now();
      return raw;
    } finally {
      inFlightUnified = null;
    }
  })();

  return inFlightUnified;
}

// 4. Legacy Live Operational Prediction (V3)
let cachedPrediction: PredictResponse | null = null;
let lastFetchTime = 0;
let inFlightPrediction: Promise<PredictResponse> | null = null;

export async function getLivePrediction(forceRefresh: boolean = false): Promise<PredictResponse> {
  const now = Date.now();
  if (!forceRefresh && cachedPrediction && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedPrediction;
  }

  if (inFlightPrediction) {
    return inFlightPrediction;
  }

  inFlightPrediction = (async () => {
    try {
      let raw: PredictResponse;
      try {
        raw = await fetchJson<PredictResponse>('/predict/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } catch {
        raw = await fetchJson<PredictResponse>('/predict/live');
      }

      if (!raw || raw.status !== 'success' || !raw.horizons) {
        throw new ApiError('Malformed prediction payload received from backend', 500, 'INVALID_PAYLOAD');
      }

      cachedPrediction = raw;
      lastFetchTime = Date.now();
      return raw;
    } finally {
      inFlightPrediction = null;
    }
  })();

  return inFlightPrediction;
}

// 5. Operational Ingestion Pipeline Health Check
export async function getPipelineHealth(): Promise<PipelineHealthResponse> {
  try {
    return await fetchJson<PipelineHealthResponse>('/health/pipeline');
  } catch (err: any) {
    return {
      status: 'error',
      himawari_status: 'UNAVAILABLE',
      gfs_status: 'UNAVAILABLE',
      temporal_alignment: 'INVALID',
      input_tensor: 'INVALID',
      model_v1_status: 'ERROR',
      model_v3_status: 'ERROR',
      model_v4_status: 'ERROR',
      message: err?.message || 'Pipeline health endpoint unreachable',
    };
  }
}

// 6. Demo Prediction on Stored Validation Sample
export async function getDemoPrediction(): Promise<PredictResponse> {
  return fetchJson<PredictResponse>('/predict/demo');
}

