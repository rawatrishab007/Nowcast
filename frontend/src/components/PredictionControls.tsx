// ============================================================
// WeatherNow AI — ChatGPT-Style Neutral Dark Hazard & Horizon Controls
// ============================================================

import React, { useEffect, useState } from 'react';
import type { UnifiedHorizonForecast, HazardType } from '../types/weather';
import { FORECAST_HORIZONS } from '../constants';

interface PredictionControlsProps {
  selectedHazard: HazardType;
  onHazardSelect: (hazard: HazardType) => void;
  selectedHorizon: number;
  onHorizonSelect: (horizon: number) => void;
  horizonsData?: Record<string, UnifiedHorizonForecast>;
  baseTime?: string;
}

export const HAZARD_CONFIG: Record<
  HazardType,
  {
    label: string;
    shortLabel: string;
    icon: string;
    category: 'neural' | 'proxy';
    unit: string;
    modelBadge: string;
    description: string;
  }
> = {
  rain: {
    label: 'Rainfall Rate',
    shortLabel: 'Rain Rate',
    icon: '🌧️',
    category: 'neural',
    unit: 'mm/hr',
    modelBadge: 'V4 Neural (IMERG)',
    description: 'Neural IMERG-calibrated precipitation rate nowcast',
  },
  rain_probability: {
    label: 'Rain Probability',
    shortLabel: 'Rain Prob',
    icon: '☔',
    category: 'neural',
    unit: 'Probability [0,1]',
    modelBadge: 'V4 Neural Binary',
    description: 'Neural rain occurrence probability nowcast',
  },
  convective_cloud: {
    label: 'Convective Cloud',
    shortLabel: 'Cold Cloud',
    icon: '☁️',
    category: 'neural',
    unit: 'P(B13 < 235 K)',
    modelBadge: 'V3 Neural ConvLSTM',
    description: 'Deep convective cold-cloud signal P(B13 < 235 K)',
  },
  lightning: {
    label: 'Severe Lightning',
    shortLabel: 'Lightning',
    icon: '⚡',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Severe Weather',
    description: 'Hazard assessment from CAPE, B13, and wind shear',
  },
  thunderstorm: {
    label: 'Thunderstorm',
    shortLabel: 'T-Storm',
    icon: '⛈️',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Severe Weather',
    description: 'Hazard assessment from CAPE × Deep Convection Index',
  },
  hail: {
    label: 'Hail Risk',
    shortLabel: 'Hail',
    icon: '🧊',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Severe Weather',
    description: 'Hazard assessment from severe updraft & freezing levels',
  },
  cloudburst: {
    label: 'Cloudburst Risk',
    shortLabel: 'Cloudburst',
    icon: '🌊',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Severe Weather',
    description: 'Hazard assessment from extreme moisture flux & instability',
  },
  downburst: {
    label: 'Downburst Risk',
    shortLabel: 'Downburst',
    icon: '💨',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Severe Weather',
    description: 'Hazard assessment from dry air entrainment & DCAPE',
  },
};

export const PredictionControls: React.FC<PredictionControlsProps> = ({
  selectedHazard,
  onHazardSelect,
  selectedHorizon,
  onHorizonSelect,
  horizonsData,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Auto-play loop through 4 horizons (1.2s per frame)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onHorizonSelect(
        selectedHorizon === 30 ? 60 :
        selectedHorizon === 60 ? 90 :
        selectedHorizon === 90 ? 120 : 30
      );
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, selectedHorizon, onHorizonSelect]);

  const activeHorizonData = horizonsData?.[String(selectedHorizon)];
  const activeHazardLayer = activeHorizonData ? (activeHorizonData[selectedHazard] as any) : undefined;
  const cfg = HAZARD_CONFIG[selectedHazard];

  return (
    <div className="dark-card p-4 sm:p-5 rounded-2xl space-y-4">
      {/* ── 1. Hazard Selection Header (Blue Heading) ── */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider font-heading">
              Hazard Outlook &amp; Layers:
            </span>
            <span className="text-xs font-bold text-white bg-[#212121] px-2.5 py-1 rounded-full border border-[#383838] flex items-center gap-1.5 shadow-sm">
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span className="text-blue-300 font-normal">({cfg.modelBadge})</span>
            </span>
          </div>
          {activeHazardLayer && (
            <div className="text-xs font-medium text-[#BDBDBD] flex items-center gap-1.5">
              <span>Domain Peak:</span>
              <span className="text-white font-bold font-mono">
                {activeHazardLayer.max} {activeHazardLayer.unit}
              </span>
            </div>
          )}
        </div>

        {/* Hazard Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {(Object.keys(HAZARD_CONFIG) as HazardType[]).map((hzKey) => {
            const isSelected = selectedHazard === hzKey;
            const hCfg = HAZARD_CONFIG[hzKey];
            const isNeural = hCfg.category === 'neural';

            return (
              <button
                key={hzKey}
                onClick={() => onHazardSelect(hzKey)}
                className={`p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md border border-blue-400 transform scale-[1.02]'
                    : 'bg-[#212121] hover:bg-[#2E2E2E] text-[#F5F5F5] border border-[#383838] hover:border-[#4F4F4F]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">{hCfg.icon}</span>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[#181818] text-blue-300 border border-[#383838]'
                    }`}
                  >
                    {isNeural ? 'Neural' : 'Hazard'}
                  </span>
                </div>
                <div className={`font-bold text-xs mt-2 truncate ${isSelected ? 'text-white' : 'text-[#F5F5F5]'}`}>
                  {hCfg.shortLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Lead Time Horizons & Animation Toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-[#383838] gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider font-heading">
            Lead Time:
          </span>

          {/* Horizon Buttons */}
          <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-[#383838] shadow-inner">
            {FORECAST_HORIZONS.map((h) => {
              const isSelected = selectedHorizon === h;
              return (
                <button
                  key={h}
                  onClick={() => {
                    setIsPlaying(false);
                    onHorizonSelect(h);
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold font-mono rounded-lg transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-[#BDBDBD] hover:text-white hover:bg-[#2A2A2A]'
                  }`}
                >
                  +{h}m
                </button>
              );
            })}
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause horizon animation' : 'Loop through forecast horizons'}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              isPlaying
                ? 'bg-blue-600 text-white shadow-md animate-pulse'
                : 'bg-[#212121] hover:bg-[#2E2E2E] text-blue-300 border border-[#383838]'
            }`}
          >
            <span>{isPlaying ? '⏸ Pause' : '▶ Loop (+30 to +120m)'}</span>
          </button>
        </div>

        {/* Method Info */}
        <div className="text-xs text-[#BDBDBD] flex items-center gap-1.5">
          <span className="font-medium text-[#737373]">Method:</span>
          <span className="font-semibold text-[#F5F5F5]">{cfg.description}</span>
        </div>
      </div>
    </div>
  );
};
