// ============================================================
// WeatherNow AI — Strict Black + Blue + White Operational Health Card
// Structure: Blue Title -> Models & Status -> Divider -> Diagnostics & IST Timestamps
// Normal status in Blue/White; Red ONLY on actual failure
// ============================================================

import React from 'react';
import type { UnifiedNowcastResponse, HealthResponse, PipelineHealthResponse } from '../types/weather';
import { formatIstDateTime, formatIstValidityWindow } from '../utils/timeUtils';

interface DataHealthMonitorProps {
  prediction?: UnifiedNowcastResponse | null;
  health?: HealthResponse | null;
  pipelineHealth?: PipelineHealthResponse | null;
}

export function computeDataFreshness(baseTime?: string | null): {
  label: string;
  isStale: boolean;
  statusText: 'LIVE' | 'STALE' | 'STANDBY';
  textClass: string;
  badgeClass: string;
} {
  if (!baseTime) {
    return {
      label: 'STANDBY',
      isStale: false,
      statusText: 'STANDBY',
      textClass: 'text-neutral-400',
      badgeClass: 'bg-[#212121] text-neutral-400 border-[#383838]',
    };
  }

  const obsTime = new Date(baseTime).getTime();
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.floor((now - obsTime) / (1000 * 60)));

  if (diffMinutes <= 60) {
    return {
      label: `LIVE — ${diffMinutes}m old`,
      isStale: false,
      statusText: 'LIVE',
      textClass: 'text-blue-400',
      badgeClass: 'bg-[#181818] text-blue-300 border border-blue-500/30',
    };
  } else if (diffMinutes < 1440) {
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return {
      label: `STALE — ${hours}h ${mins}m old`,
      isStale: true,
      statusText: 'STALE',
      textClass: 'text-red-400',
      badgeClass: 'bg-red-950/80 text-red-300 border-red-800',
    };
  } else {
    const days = Math.floor(diffMinutes / 1440);
    const hours = Math.floor((diffMinutes % 1440) / 60);
    const label = days === 1 ? `STALE — ~1d old` : `STALE — ${days}d ${hours}h old`;
    return {
      label,
      isStale: true,
      statusText: 'STALE',
      textClass: 'text-red-400',
      badgeClass: 'bg-red-950/80 text-red-300 border-red-800',
    };
  }
}

export const DataHealthMonitor: React.FC<DataHealthMonitorProps> = ({
  prediction,
  health,
}) => {
  const perf = prediction?.provenance?.performance;

  const v1Status = health?.models_status?.v1_hazard_proxies !== false ? 'LOADED' : 'ERROR';
  const v3Status = health?.models_status?.v3_convective_cloud !== false ? 'LOADED' : 'ERROR';
  const v4Status = health?.models_status?.v4_rainfall !== false ? 'LOADED' : 'ERROR';

  const baseTimeStr = formatIstDateTime(prediction?.base_time, 'Awaiting Observation');
  const targetTimes = prediction?.provenance?.target_times || {};
  const validWindowStr = formatIstValidityWindow(targetTimes['30'], targetTimes['120']);

  const freshness = computeDataFreshness(prediction?.base_time);

  const modelRows = [
    {
      id: 'v4',
      name: 'V4 Rainfall',
      spec: 'Dual-Head ConvLSTM (93k params)',
      status: v4Status,
      isOk: v4Status === 'LOADED',
    },
    {
      id: 'v3',
      name: 'V3 Convection',
      spec: 'Cold-Cloud ConvLSTM (201k params)',
      status: v3Status,
      isOk: v3Status === 'LOADED',
    },
    {
      id: 'v1',
      name: 'V1 Severe Weather',
      spec: 'Hazard Assessment Proxies',
      status: v1Status,
      isOk: v1Status === 'LOADED',
    },
  ];

  return (
    <div className="dark-card p-4 sm:p-5 rounded-2xl space-y-3.5 shadow-lg border border-[#383838] flex flex-col justify-between h-full min-h-[340px]">
      {/* ── 1. Header (Blue Heading) ── */}
      <div className="flex items-center justify-between border-b border-[#383838] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <h3 className="font-bold text-blue-400 text-xs uppercase tracking-wider font-heading">
            Operational Health
          </h3>
        </div>
        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold font-mono ${freshness.badgeClass}`}>
          {freshness.label}
        </span>
      </div>

      {/* ── 2. Top Section: Models & Status (Blue/White) ── */}
      <div className="space-y-2">
        {modelRows.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between bg-[#212121] px-3.5 py-2 rounded-xl border border-[#383838] hover:border-neutral-500 transition-colors"
          >
            <div className="min-w-0 pr-2">
              <div className="text-xs font-bold text-white tracking-tight truncate font-sans">
                {m.name}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono truncate">
                {m.spec}
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold shrink-0 tracking-wider ${
                m.isOk
                  ? 'bg-[#181818] text-blue-300 border border-[#383838]'
                  : 'bg-red-950/80 text-red-300 border border-red-800'
              }`}
            >
              {m.status}
            </span>
          </div>
        ))}
      </div>

      {/* ── 3. Bottom Section: Two-Column Structured Operational Diagnostics ── */}
      <div className="space-y-2 pt-2.5 border-t border-[#383838]">
        {/* Row 1: Observation */}
        <div className="grid grid-cols-12 gap-2 text-xs items-center">
          <span className="col-span-4 text-neutral-400 font-medium truncate">Observation</span>
          <span className="col-span-8 text-right text-white font-mono font-semibold truncate text-[11.5px]">
            {baseTimeStr}
          </span>
        </div>

        {/* Row 2: Forecast Window */}
        <div className="grid grid-cols-12 gap-2 text-xs items-center">
          <span className="col-span-4 text-neutral-400 font-medium truncate">Forecast Window</span>
          <span className="col-span-8 text-right text-blue-400 font-mono font-semibold truncate text-[11.5px]">
            {validWindowStr}
          </span>
        </div>

        {/* Row 3: Data Freshness */}
        <div className="grid grid-cols-12 gap-2 text-xs items-center">
          <span className="col-span-4 text-neutral-400 font-medium truncate">Data Freshness</span>
          <span className={`col-span-8 text-right font-mono font-semibold truncate text-[11.5px] ${freshness.textClass}`}>
            {freshness.label}
          </span>
        </div>

        {/* Row 4: Pipeline Latency */}
        <div className="grid grid-cols-12 gap-2 text-xs items-center">
          <span className="col-span-4 text-neutral-400 font-medium truncate">Pipeline Latency</span>
          <span className="col-span-8 text-right text-white font-mono font-semibold truncate text-[11.5px]">
            {perf ? `${perf.inference_latency_ms ?? 0} ms infer • ${((perf.total_latency_ms ?? 0) / 1000).toFixed(2)} s total` : 'Ready'}
          </span>
        </div>
      </div>
    </div>
  );
};
