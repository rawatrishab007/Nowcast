// ============================================================
// WeatherNow AI — ChatGPT-Style Neutral Dark Header
// ============================================================

import React from 'react';
import type { UnifiedNowcastResponse, HealthResponse, WeatherLocation } from '../types/weather';
import { exportForecastAsCsv, exportForecastAsJson } from '../utils/exportUtils';
import { formatIstDateTime } from '../utils/timeUtils';

interface HeaderProps {
  prediction: UnifiedNowcastResponse | null;
  health: HealthResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
  selectedLocation: WeatherLocation;
  onOpenSituationReport: () => void;
  activeNavTab?: string;
  onNavTabChange?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  prediction,
  health,
  isLoading,
  onRefresh,
  selectedLocation,
  onOpenSituationReport,
  activeNavTab = 'Home',
  onNavTabChange,
}) => {
  const isModelLoaded = health?.model_loaded ?? false;
  const isLiveMode = prediction?.data_mode === 'live';
  const obsTimestamp =
    prediction?.provenance?.observation_timestamp_utc ||
    prediction?.provenance?.observation_timestamp ||
    prediction?.base_time;
  const baseTimeStr = formatIstDateTime(obsTimestamp);

  const currentTab = activeNavTab || 'Home';

  const navItems = ['Home', 'Reports'];

  const handleTabClick = (tab: string) => {
    onNavTabChange?.(tab);
    if (tab === 'Reports') {
      onOpenSituationReport();
    }
  };

  const handleExportCsv = () => {
    if (prediction) {
      exportForecastAsCsv(prediction, selectedLocation);
    }
  };

  const handleExportJson = () => {
    if (prediction) {
      exportForecastAsJson(prediction, selectedLocation);
    }
  };

  return (
    <header className="bg-[#212121] border-b border-[#383838] px-4 sm:px-6 py-3 sticky top-0 z-30 shadow-md">
      <div className="max-w-[1680px] mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* ── Brand & Identity ── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl text-white shadow-md border border-blue-400/40">
            🛰️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight font-heading">
                Megh <span className="text-blue-400 font-black">Setu</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#2A2A2A] text-blue-300 border border-[#444444] font-bold">
                SIH26084
              </span>
            </div>
            <p className="text-[11px] text-[#BDBDBD] font-medium tracking-wide">
              Convective Weather Nowcasting &bull; Domain: 8°N–38°N, 68°E–98°E
            </p>
          </div>
        </div>

        {/* ── Central Navigation Tabs (Home | Reports) ── */}
        <nav className="flex items-center bg-[#181818] p-1 rounded-full border border-[#383838] shadow-inner">
          {navItems.map((tab) => {
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md font-bold'
                    : 'text-[#BDBDBD] hover:text-white hover:bg-[#2A2A2A]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>

        {/* ── Right Actions & Operational Status ── */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-between lg:justify-end">
          {/* Observation Timestamp Pill */}
          <div className="flex items-center gap-1.5 bg-[#2A2A2A] border border-[#383838] px-3 py-1.5 rounded-full text-xs font-mono shadow-sm">
            <span className="text-blue-400 text-[10px] font-bold">t₀:</span>
            <span className="text-white font-bold text-[11px]">{baseTimeStr}</span>
          </div>

          {/* Live Ingestion Status (Blue/White for Normal, Red for Error) */}
          <div className="flex items-center gap-2 bg-[#2A2A2A] border border-[#383838] px-3 py-1.5 rounded-full text-xs font-mono shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                isLiveMode
                  ? 'bg-blue-400 animate-pulse'
                  : isModelLoaded
                  ? 'bg-blue-400'
                  : 'bg-red-500 animate-ping'
              }`}
            />
            <span className="text-[#F5F5F5] font-semibold text-[11px]">
              {isLiveMode ? 'Himawari-9 + GFS Live' : isModelLoaded ? 'Models Ready' : 'Pipeline Standby'}
            </span>
          </div>

          {/* Situation Report CTA */}
          <button
            onClick={onOpenSituationReport}
            disabled={!prediction}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#2A2A2A] hover:bg-[#333333] border border-[#444444] text-blue-300 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-sm disabled:opacity-40 active:scale-95"
          >
            <span>📄</span>
            <span>Situation Report</span>
          </button>

          {/* Data Export Pills */}
          <div className="flex items-center bg-[#181818] border border-[#383838] rounded-full p-0.5 font-mono text-xs">
            <button
              onClick={handleExportCsv}
              disabled={!prediction}
              title="Download 4-Horizon CSV"
              className="px-2.5 py-1 text-[#BDBDBD] hover:text-blue-300 hover:bg-[#2A2A2A] rounded-full text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              CSV
            </button>
            <span className="text-[#555555]">|</span>
            <button
              onClick={handleExportJson}
              disabled={!prediction}
              title="Download 4-Horizon JSON"
              className="px-2.5 py-1 text-[#BDBDBD] hover:text-blue-300 hover:bg-[#2A2A2A] rounded-full text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              JSON
            </button>
          </div>

          {/* Live Run Action Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold font-mono transition-all cursor-pointer shadow-md active:scale-95 ${
              isLoading
                ? 'bg-[#333333] text-blue-300 border border-[#444444] cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <span className={isLoading ? 'animate-spin inline-block' : ''}>🔄</span>
            <span>{isLoading ? 'Fetching...' : 'Live Run'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
