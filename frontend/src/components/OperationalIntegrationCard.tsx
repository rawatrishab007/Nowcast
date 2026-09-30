// ============================================================
// WeatherNow AI — Strict Black + Blue + White Operational Integration Card
// Structure: Blue Title -> Standardized Rows: ● [System Name] ... [Status]
// Normal state is Blue/White; Red ONLY on actual failure
// ============================================================

import React from 'react';
import type { UnifiedNowcastResponse, PipelineHealthResponse, HealthResponse } from '../types/weather';

interface OperationalIntegrationCardProps {
  prediction?: UnifiedNowcastResponse | null;
  pipelineHealth?: PipelineHealthResponse | null;
  health?: HealthResponse | null;
}

export const OperationalIntegrationCard: React.FC<OperationalIntegrationCardProps> = ({
  prediction,
  pipelineHealth,
  health,
}) => {
  const isLive = prediction?.data_mode === 'live';

  const himawariStatus = pipelineHealth?.himawari_status || (isLive ? 'CONNECTED' : 'STANDBY');
  const gfsStatus = pipelineHealth?.gfs_status || (isLive ? 'CONNECTED' : 'STANDBY');
  const alignmentStatus = pipelineHealth?.temporal_alignment || (prediction ? 'VALID' : 'STANDBY');
  const tensorStatus = pipelineHealth?.input_tensor || (prediction ? 'VALID' : 'STANDBY');

  const integrations = [
    {
      id: 'himawari',
      name: 'Himawari-9 AHI',
      detail: 'Band 13 (10.4µm Infrared)',
      status: himawariStatus,
      isOk: himawariStatus === 'CONNECTED',
    },
    {
      id: 'gfs',
      name: 'GFS 0.25° NWP',
      detail: '7 Synchronized Met Channels',
      status: gfsStatus,
      isOk: gfsStatus === 'CONNECTED',
    },
    {
      id: 'alignment',
      name: 'Time Alignment',
      detail: '6 Temporal Frames (t-50 to t₀)',
      status: alignmentStatus,
      isOk: alignmentStatus === 'VALID',
    },
    {
      id: 'tensor',
      name: 'Tensor Input',
      detail: 'Shape (1, 6, 8, 128, 128)',
      status: tensorStatus,
      isOk: tensorStatus === 'VALID',
    },
  ];

  return (
    <div className="dark-card p-4 sm:p-5 rounded-2xl space-y-3.5 shadow-lg border border-[#383838] flex flex-col justify-between h-full min-h-[340px]">
      {/* ── 1. Header (Blue Heading) ── */}
      <div className="flex items-center justify-between border-b border-[#383838] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📡</span>
          <h3 className="font-bold text-blue-400 text-xs uppercase tracking-wider font-heading">
            Operational Integration
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#212121] text-blue-300 border border-[#383838] font-semibold">
          Live Feeds
        </span>
      </div>

      {/* ── 2. Standardized Integration Rows ── */}
      <div className="flex-1 flex flex-col justify-around py-1 space-y-2">
        {integrations.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between bg-[#212121] px-3.5 py-2.5 rounded-xl border border-[#383838] hover:border-neutral-500 transition-colors"
          >
            {/* Left: Fixed-width Dot Indicator + System Name */}
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-3 flex items-center justify-center shrink-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item.isOk
                      ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]'
                      : 'bg-red-500 animate-pulse'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white tracking-tight truncate font-sans">
                  {item.name}
                </div>
                <div className="text-[10px] text-neutral-400 font-mono truncate">
                  {item.detail}
                </div>
              </div>
            </div>

            {/* Right: Aligned Status Badge */}
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold shrink-0 tracking-wider ${
                item.isOk
                  ? 'bg-[#181818] text-blue-300 border border-[#383838]'
                  : 'bg-red-950/80 text-red-300 border border-red-800'
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>

      {/* ── 3. Bottom Summary / Provenance ── */}
      <div className="flex items-center justify-between text-xs text-neutral-400 pt-3 border-t border-[#383838]">
        <div>
          <span className="text-neutral-500">Domain: </span>
          <span className="text-white font-semibold font-mono">8°N–38°N, 68°E–98°E</span>
        </div>
        <div>
          <span className="text-neutral-500">Device: </span>
          <span className="text-blue-400 font-semibold font-mono uppercase">{health?.device || 'MPS'}</span>
        </div>
      </div>
    </div>
  );
};
