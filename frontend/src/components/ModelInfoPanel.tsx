// ============================================================
// WeatherNow AI — Model & Architecture Specification Panel
// Multi-Model Architecture Documentation (V4, V3, V1)
// ============================================================

import React from 'react';
import type { UnifiedNowcastResponse, HealthResponse } from '../types/weather';

interface ModelInfoPanelProps {
  prediction?: UnifiedNowcastResponse | null;
  health?: HealthResponse | null;
}

export const ModelInfoPanel: React.FC<ModelInfoPanelProps> = ({
  prediction,
  health,
}) => {
  const perf = prediction?.provenance?.performance;

  return (
    <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-4 shadow-lg space-y-4 text-xs">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-gray-700/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <h3 className="font-bold text-white text-sm">Model Specifications</h3>
        </div>
        <span className="px-2 py-0.5 rounded bg-teal-900/60 text-teal-300 border border-teal-700/80 font-mono font-semibold text-[10px]">
          Unified Multi-Model Pipeline
        </span>
      </div>

      {/* 3 Model Architecture Summary Cards */}
      <div className="space-y-2">
        {/* Model V4 */}
        <div className="bg-gray-900/90 border border-teal-900/80 p-2.5 rounded-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-teal-400 font-mono">1. SIHV4RainfallNowcast (V4)</span>
            <span className="text-[10px] bg-teal-950 text-teal-300 px-1.5 py-0.5 rounded font-mono">
              93,208 params
            </span>
          </div>
          <p className="text-gray-300 text-[11px]">
            Dual-head ConvLSTM model predicting continuous rainfall rate (<span className="text-teal-300 font-mono">mm/hr</span>) and occurrence probability (<span className="text-teal-300 font-mono">[0, 1]</span>) across 4 horizons.
          </p>
        </div>

        {/* Model V3 */}
        <div className="bg-gray-900/90 border border-cyan-900/80 p-2.5 rounded-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-400 font-mono">2. SIHV3Nowcast (V3)</span>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
              200,996 params
            </span>
          </div>
          <p className="text-gray-300 text-[11px]">
            Deep ConvLSTM model predicting cold-cloud deep convection probability <span className="text-cyan-300 font-mono">P(future B13 &lt; 235 K)</span> over lead times up to 120 minutes.
          </p>
        </div>

        {/* Model V1 */}
        <div className="bg-gray-900/90 border border-amber-900/80 p-2.5 rounded-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-400 font-mono">3. Physics Proxy Engine (V1)</span>
            <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-mono">
              Physics-Informed
            </span>
          </div>
          <p className="text-gray-300 text-[11px]">
            Physics-informed proxy engine deriving risk scores for lightning, thunderstorms, hail, cloudbursts, and downbursts from atmospheric thermodynamic profiles.
          </p>
        </div>
      </div>

      {/* Input Channels (8 meteorological fields) */}
      <div>
        <span className="text-gray-400 text-[11px] font-semibold block mb-1.5 font-mono">
          Synchronized Input Channels (6 temporal frames × 8 channels):
        </span>
        <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
          {[
            { ch: '0. B13', name: 'AHI 10.4µm (K)', src: 'Himawari-9' },
            { ch: '1. t2m', name: '2m Temp (°C)', src: 'NOAA GFS' },
            { ch: '2. d2m', name: '2m Dew Pt (°C)', src: 'NOAA GFS' },
            { ch: '3. u10', name: '10m U-Wind (m/s)', src: 'NOAA GFS' },
            { ch: '4. v10', name: '10m V-Wind (m/s)', src: 'NOAA GFS' },
            { ch: '5. cape', name: 'CAPE (J/kg)', src: 'NOAA GFS' },
            { ch: '6. cin', name: 'CIN (J/kg)', src: 'NOAA GFS' },
            { ch: '7. tp', name: 'Precipitation (m)', src: 'NOAA GFS' },
          ].map((item) => (
            <div
              key={item.ch}
              className="bg-gray-900/90 border border-gray-700/60 p-1.5 rounded text-center"
            >
              <div className="text-white font-bold">{item.ch}</div>
              <div className="text-gray-400 text-[9px] truncate">{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Latency & Ingestion Feeds */}
      {perf && (
        <div className="border-t border-gray-700/80 pt-2.5 font-mono text-[10px] space-y-1 text-gray-400">
          <div className="flex justify-between">
            <span>Inference Hardware:</span>
            <span className="text-gray-200 font-bold uppercase">{perf.device || health?.device || 'CPU'}</span>
          </div>
          <div className="flex justify-between">
            <span>Model Forward Latency:</span>
            <span className="text-teal-300 font-bold">{perf.inference_latency_ms} ms</span>
          </div>
          <div className="flex justify-between">
            <span>Total Operational Pipeline:</span>
            <span className="text-teal-300 font-bold">{perf.total_latency_ms} ms</span>
          </div>
        </div>
      )}
    </div>
  );
};
