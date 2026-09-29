// ============================================================
// WeatherNow AI — Header Component
// ============================================================

import React from 'react';
import type { UnifiedNowcastResponse, PredictResponse, HealthResponse } from '../types/weather';

interface HeaderProps {
  prediction: UnifiedNowcastResponse | PredictResponse | null;
  health: HealthResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  prediction,
  health,
  isLoading,
  onRefresh,
}) => {
  const isModelLoaded = health?.model_loaded ?? false;
  const isLiveMode = prediction?.data_mode === 'live';
  const baseTimeStr = prediction?.base_time
    ? new Date(prediction.base_time).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : 'Awaiting Observation';

  return (
    <header className="bg-gray-900/95 border-b border-gray-800 px-4 py-3 sm:px-6 shadow-md backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Brand & Model Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-xl shadow-lg shadow-teal-500/20">
            🛰️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-white tracking-tight">
                WeatherNow <span className="text-teal-400">AI</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 font-semibold">
                Unified Multi-Model Nowcasting
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              V4 Rainfall &bull; V3 Convective Cloud &bull; V1 Physics Proxies &bull; Domain: 8°N–38°N, 68°E–98°E
            </p>
          </div>
        </div>

        {/* Live Status & Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto justify-between md:justify-end">
          {/* Observation Timestamp */}
          <div className="flex items-center gap-1.5 bg-gray-800/90 border border-gray-700/80 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span className="text-gray-400 text-[10px]">t₀ Observation:</span>
            <span className="text-teal-300 font-bold">{baseTimeStr}</span>
          </div>

          {/* Data Pipeline Status Badge */}
          <div className="flex items-center gap-1.5 bg-gray-800/90 border border-gray-700/80 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveMode
                  ? 'bg-emerald-400 animate-pulse'
                  : isModelLoaded
                  ? 'bg-amber-400'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-gray-300 font-semibold">
              {isLiveMode ? 'Live (Himawari-9 + GFS)' : isModelLoaded ? 'Models Ready' : 'Offline'}
            </span>
            {health?.device && (
              <span className="text-[10px] text-gray-400 border-l border-gray-700 pl-1.5 uppercase">
                {health.device}
              </span>
            )}
          </div>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer shadow-sm ${
              isLoading
                ? 'bg-teal-900/60 text-teal-300 border border-teal-700/60 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-600/30'
            }`}
          >
            <span className={isLoading ? 'animate-spin inline-block' : ''}>🔄</span>
            <span>{isLoading ? 'Running...' : 'Live Run'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
