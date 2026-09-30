// ============================================================
// WeatherNow AI — ChatGPT-Style Summary Metric Cards (4 Cards Grid)
// ============================================================

import React from 'react';
import type { UnifiedNowcastResponse, HealthResponse, PipelineHealthResponse, WeatherLocation, HazardType } from '../types/weather';
import { SPATIAL_BOUNDS, FORECAST_HORIZONS } from '../constants';
import { HAZARD_CONFIG } from './PredictionControls';
import { formatIstDateTime, formatIstValidityWindow } from '../utils/timeUtils';
import { computeDataFreshness } from './DataHealthMonitor';

interface SummaryMetricCardsProps {
  prediction: UnifiedNowcastResponse | null;
  health: HealthResponse | null;
  pipelineHealth: PipelineHealthResponse | null;
  selectedLocation: WeatherLocation;
  selectedHazard: HazardType;
  selectedHorizon: number;
}

export const SummaryMetricCards: React.FC<SummaryMetricCardsProps> = ({
  prediction,
  health,
  pipelineHealth,
  selectedLocation,
  selectedHazard,
  selectedHorizon,
}) => {
  const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;
  const row = Math.min(127, Math.max(0, Math.round(((maxLat - selectedLocation.lat) / (maxLat - minLat)) * 127)));
  const col = Math.min(127, Math.max(0, Math.round(((selectedLocation.lng - minLng) / (maxLng - minLng)) * 127)));

  const activeHorizonData = prediction?.horizons?.[String(selectedHorizon)];
  const activeHazardData = activeHorizonData ? (activeHorizonData[selectedHazard] as any) : undefined;
  const currentVal = activeHazardData?.map?.[row]?.[col] ?? 0;

  // Peak horizon calculation
  let peakHorizon = 30;
  let maxVal = -1;
  FORECAST_HORIZONS.forEach((h) => {
    const hData = prediction?.horizons?.[String(h)];
    const hzLayer = hData ? (hData[selectedHazard] as any) : undefined;
    const v = hzLayer?.map?.[row]?.[col] ?? 0;
    if (v > maxVal) {
      maxVal = v;
      peakHorizon = h;
    }
  });

  const hzCfg = HAZARD_CONFIG[selectedHazard] || { label: 'Hazard Rate', shortLabel: 'Hazard', unit: '' };

  // Data Freshness
  const obsTimestamp = prediction?.provenance?.observation_timestamp || prediction?.base_time;
  const istObsTime = obsTimestamp ? formatIstDateTime(obsTimestamp) : 'Syncing...';
  const freshness = computeDataFreshness(obsTimestamp);

  // Latency & Device
  const totalLatencyMs = prediction?.provenance?.performance?.total_latency_ms ?? 0;
  const inferLatencyMs = prediction?.provenance?.performance?.inference_latency_ms ?? 0;
  const device = prediction?.provenance?.performance?.device || health?.device || 'MPS';

  // Tensor & Alignment
  const tensorShape = prediction?.provenance?.input_tensor_shape
    ? `(${prediction.provenance.input_tensor_shape.join(', ')})`
    : '(1, 6, 8, 128, 128)';
  const alignmentStatus = pipelineHealth?.temporal_alignment || 'VALID';
  const himawariConnected = pipelineHealth?.himawari_status === 'CONNECTED' || (prediction ? true : false);

  const targetTimes = prediction?.provenance?.target_times || {};
  const validityRangeStr = formatIstValidityWindow(targetTimes['30'], targetTimes['120']);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ── Card 1: Active Forecast Assessment ── */}
      <div className="dark-card p-4 rounded-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span className="text-[11px] font-bold tracking-wider text-blue-400 uppercase font-heading">
              {hzCfg.shortLabel} Nowcast (+{selectedHorizon}m)
            </span>
          </div>
          <span className="text-[10px] font-semibold text-blue-300 bg-[#212121] px-2 py-0.5 rounded-full border border-[#383838] font-heading">
            {selectedLocation.isCustom ? 'PROBE' : 'STATION'}
          </span>
        </div>

        <div className="my-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-[#F5F5F5] tracking-tight font-heading">
              {selectedHazard === 'rain'
                ? currentVal.toFixed(2)
                : selectedHazard === 'convective_cloud' || selectedHazard === 'rain_probability'
                ? (currentVal * 100).toFixed(1)
                : currentVal.toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-[#BDBDBD]">
              {selectedHazard === 'convective_cloud' || selectedHazard === 'rain_probability' ? '%' : hzCfg.unit}
            </span>
          </div>
          <p className="text-xs text-[#BDBDBD] truncate mt-0.5 font-medium">
            {selectedLocation.name}
          </p>
        </div>

        <div className="pt-2 border-t border-[#383838] flex items-center justify-between text-[11px] text-[#BDBDBD] font-medium">
          <span>Peak: +{peakHorizon}m</span>
          <span className="font-semibold text-blue-400">
            {selectedHazard === 'rain'
              ? `${maxVal.toFixed(1)} mm/h`
              : selectedHazard === 'convective_cloud' || selectedHazard === 'rain_probability'
              ? `${(maxVal * 100).toFixed(0)}%`
              : maxVal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── Card 2: Input Quality & Alignment ── */}
      <div className="dark-card p-4 rounded-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span className="text-[11px] font-bold tracking-wider text-blue-400 uppercase font-heading">
              Tensor Input &amp; Grid
            </span>
          </div>
          <span className="text-[10px] font-semibold text-blue-300 bg-[#212121] px-2 py-0.5 rounded-full border border-[#383838] font-heading">
            {alignmentStatus === 'VALID' ? 'ALIGNED' : alignmentStatus}
          </span>
        </div>

        <div className="my-1">
          <div className="text-lg font-bold text-[#F5F5F5] font-mono tracking-tight">
            {tensorShape}
          </div>
          <p className="text-xs text-[#BDBDBD] mt-0.5 font-medium">
            Himawari-9 B13 + 7 GFS NWP Channels
          </p>
        </div>

        <div className="pt-2 border-t border-[#383838] flex items-center justify-between text-[11px] text-[#BDBDBD] font-mono">
          <span>60km &bull; 128&times;128 Grid</span>
          <span className="font-semibold text-blue-400">6 Frames (t-50 to t₀)</span>
        </div>
      </div>

      {/* ── Card 3: Pipeline Performance & Hardware ── */}
      <div className="dark-card p-4 rounded-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span className="text-[11px] font-bold tracking-wider text-blue-400 uppercase font-heading">
              Pipeline Latency
            </span>
          </div>
          <span className="text-[10px] font-semibold text-blue-300 bg-[#212121] px-2 py-0.5 rounded-full border border-[#383838] uppercase font-heading">
            {device} ACCEL
          </span>
        </div>

        <div className="my-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-[#F5F5F5] tracking-tight font-heading">
              {(totalLatencyMs / 1000).toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-[#BDBDBD]">seconds total</span>
          </div>
          <p className="text-xs text-[#BDBDBD] mt-0.5 font-medium">
            V4 + V3 + V1 Tri-Model Execution
          </p>
        </div>

        <div className="pt-2 border-t border-[#383838] flex items-center justify-between text-[11px] text-[#BDBDBD] font-mono">
          <span>Inference:</span>
          <span className="font-semibold text-blue-400">{inferLatencyMs.toFixed(1)} ms</span>
        </div>
      </div>

      {/* ── Card 4: Live Data Freshness & IST Timestamp ── */}
      <div className="dark-card p-4 rounded-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span className="text-[11px] font-bold tracking-wider text-blue-400 uppercase font-heading">
              Observation Sync
            </span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border font-heading ${
            freshness.isStale
              ? 'bg-red-950/80 text-red-300 border-red-800'
              : 'bg-[#212121] text-blue-300 border border-[#383838]'
          }`}>
            {freshness.statusText}
          </span>
        </div>

        <div className="my-1">
          <div className="text-xs font-bold text-[#F5F5F5] tracking-tight font-heading truncate">
            {istObsTime}
          </div>
          <p className="text-[11px] text-[#BDBDBD] mt-0.5 font-medium">
            Valid: {validityRangeStr}
          </p>
        </div>

        <div className="pt-2 border-t border-[#383838] flex items-center justify-between text-[11px] text-[#BDBDBD]">
          <span>Himawari-9 Ingest:</span>
          <span className={`font-semibold ${himawariConnected ? 'text-blue-400' : 'text-red-400'}`}>
            {himawariConnected ? 'ONLINE' : 'CACHED'}
          </span>
        </div>
      </div>
    </div>
  );
};
