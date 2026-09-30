// ============================================================
// WeatherNow AI — Premium Dark Model & Architecture Specifications
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
    <div className="dark-card p-4 sm:p-5 rounded-2xl space-y-4 shadow-lg flex flex-col justify-between h-full min-h-[340px]">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <h3 className="font-bold text-white text-sm font-heading">Model Specifications</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-heading font-bold text-[10px]">
          Multi-Model Pipeline
        </span>
      </div>

      {/* 3 Model Architecture Summary Cards */}
      <div className="space-y-2">
        {/* Model V4 */}
        <div className="bg-[#0F172A] border border-white/[0.06] p-3 rounded-xl space-y-1 hover:border-white/[0.12] transition-all">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-400 text-xs font-heading">1. SIHV4RainfallNowcast (V4)</span>
            <span className="text-[10px] bg-blue-950/80 text-blue-300 px-2 py-0.5 rounded-full font-bold font-mono border border-blue-800/70">
              93k params
            </span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Dual-head ConvLSTM predicting continuous rainfall rate (<span className="text-blue-400 font-mono font-semibold">mm/hr</span>) and occurrence probability (<span className="text-blue-400 font-mono font-semibold">[0, 1]</span>) across 4 horizons.
          </p>
        </div>

        {/* Model V3 */}
        <div className="bg-[#0F172A] border border-white/[0.06] p-3 rounded-xl space-y-1 hover:border-white/[0.12] transition-all">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-400 text-xs font-heading">2. SIHV3Nowcast (V3)</span>
            <span className="text-[10px] bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded-full font-bold font-mono border border-indigo-800/70">
              201k params
            </span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Deep ConvLSTM predicting cold-cloud deep convection probability <span className="text-indigo-400 font-mono font-semibold">P(future B13 &lt; 235 K)</span> over lead times up to 120 minutes.
          </p>
        </div>

        {/* Model V1 */}
        <div className="bg-[#0F172A] border border-white/[0.06] p-3 rounded-xl space-y-1 hover:border-white/[0.12] transition-all">
          <div className="flex items-center justify-between">
            <span className="font-bold text-violet-400 text-xs font-heading">3. Severe Weather Assessment (V1)</span>
            <span className="text-[10px] bg-violet-950/80 text-violet-300 px-2 py-0.5 rounded-full font-bold font-mono border border-violet-800/70">
              Severe Proxy
            </span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Severe hazard proxies deriving risk scores for lightning, thunderstorms, hail, cloudbursts, and downbursts from atmospheric thermodynamic profiles.
          </p>
        </div>
      </div>

      {/* Input Channels (8 meteorological fields) */}
      <div>
        <span className="text-slate-400 text-[11px] font-bold block mb-2 font-heading uppercase tracking-wider">
          Synchronized Input Channels (6 frames × 8 channels):
        </span>
        <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
          {[
            { ch: '0. B13', name: 'AHI 10.4µm', src: 'Himawari-9' },
            { ch: '1. t2m', name: '2m Temp', src: 'NOAA GFS' },
            { ch: '2. d2m', name: '2m Dew Pt', src: 'NOAA GFS' },
            { ch: '3. u10', name: '10m U-Wind', src: 'NOAA GFS' },
            { ch: '4. v10', name: '10m V-Wind', src: 'NOAA GFS' },
            { ch: '5. cape', name: 'CAPE', src: 'NOAA GFS' },
            { ch: '6. cin', name: 'CIN', src: 'NOAA GFS' },
            { ch: '7. tp', name: 'Precip (m)', src: 'NOAA GFS' },
          ].map((item) => (
            <div
              key={item.ch}
              className="bg-[#0B1120] border border-white/[0.06] p-1.5 rounded-xl text-center"
            >
              <div className="text-slate-200 font-bold">{item.ch}</div>
              <div className="text-slate-400 text-[9px] truncate">{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Latency & Ingestion Feeds */}
      {perf && (
        <div className="border-t border-white/[0.08] pt-2 text-xs space-y-1 text-slate-400 font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500">Hardware Accel:</span>
            <span className="text-slate-200 font-bold uppercase">{perf.device || health?.device || 'CPU'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Model Inference:</span>
            <span className="text-blue-400 font-bold">{perf.inference_latency_ms} ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Latency:</span>
            <span className="text-blue-400 font-bold">{perf.total_latency_ms} ms</span>
          </div>
        </div>
      )}
    </div>
  );
};
