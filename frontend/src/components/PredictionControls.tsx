// ============================================================
// WeatherNow AI — Multi-Model Hazard & Horizon Prediction Controls
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
    modelBadge: 'V1 Physics Proxy',
    description: 'Physics-informed proxy from CAPE, B13, and wind shear',
  },
  thunderstorm: {
    label: 'Thunderstorm',
    shortLabel: 'T-Storm',
    icon: '⛈️',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Physics Proxy',
    description: 'Physics-informed proxy from CAPE × Deep Convection Index',
  },
  hail: {
    label: 'Hail Risk',
    shortLabel: 'Hail',
    icon: '🧊',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Physics Proxy',
    description: 'Physics-informed proxy from severe updraft & freezing levels',
  },
  cloudburst: {
    label: 'Cloudburst Risk',
    shortLabel: 'Cloudburst',
    icon: '🌊',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Experimental Proxy',
    description: 'Experimental proxy from extreme moisture flux & instability',
  },
  downburst: {
    label: 'Downburst Risk',
    shortLabel: 'Downburst',
    icon: '💨',
    category: 'proxy',
    unit: 'Risk Score [0,1]',
    modelBadge: 'V1 Physics Proxy',
    description: 'Physics-informed proxy from dry air entrainment & DCAPE',
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
    <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-4 shadow-lg space-y-3.5">
      {/* ── 1. Hazard Selection Tabs ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
              Hazard Layer:
            </span>
            <span className="text-[11px] text-teal-400 font-mono font-semibold">
              {cfg.icon} {cfg.label} ({cfg.modelBadge})
            </span>
          </div>
          {activeHazardLayer && (
            <div className="text-[11px] font-mono text-gray-300">
              Domain Max:{' '}
              <span className="text-teal-300 font-bold">
                {activeHazardLayer.max} {activeHazardLayer.unit}
              </span>
            </div>
          )}
        </div>

        {/* Hazard Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
          {(Object.keys(HAZARD_CONFIG) as HazardType[]).map((hzKey) => {
            const isSelected = selectedHazard === hzKey;
            const hCfg = HAZARD_CONFIG[hzKey];
            const isNeural = hCfg.category === 'neural';

            return (
              <button
                key={hzKey}
                onClick={() => onHazardSelect(hzKey)}
                className={`px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer border flex flex-col justify-between ${
                  isSelected
                    ? isNeural
                      ? 'bg-teal-900/60 border-teal-500 text-white shadow-md shadow-teal-950/40 ring-1 ring-teal-500/50'
                      : 'bg-amber-900/40 border-amber-500 text-white shadow-md shadow-amber-950/40 ring-1 ring-amber-500/50'
                    : 'bg-gray-900/80 border-gray-700/80 text-gray-400 hover:text-gray-200 hover:bg-gray-800/80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm">{hCfg.icon}</span>
                  <span
                    className={`text-[8px] font-mono uppercase px-1 rounded ${
                      isNeural ? 'bg-teal-950 text-teal-300' : 'bg-gray-800 text-amber-300'
                    }`}
                  >
                    {isNeural ? 'Neural' : 'Proxy'}
                  </span>
                </div>
                <div className="font-semibold text-[11px] mt-1 truncate">{hCfg.shortLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Lead Time Horizons & Animation Toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-gray-700/60 gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono mr-1">
            Lead Time:
          </span>

          {/* Horizon Buttons */}
          <div className="flex items-center gap-1.5 bg-gray-900/80 p-1 rounded-lg border border-gray-700">
            {FORECAST_HORIZONS.map((h) => {
              const isSelected = selectedHorizon === h;
              return (
                <button
                  key={h}
                  onClick={() => {
                    setIsPlaying(false);
                    onHorizonSelect(h);
                  }}
                  className={`px-3 py-1 text-xs font-bold font-mono rounded-md transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  +{h} min
                </button>
              );
            })}
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause animation loop' : 'Play horizon animation loop'}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isPlaying
                ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            <span>{isPlaying ? '⏸ Pause' : '▶ Loop (30-120m)'}</span>
          </button>
        </div>

        {/* Active Target Time & Method Info */}
        <div className="text-[11px] font-mono text-gray-400 flex items-center gap-2">
          <span className="text-gray-500">Method:</span>
          <span className="text-gray-300 font-semibold">{cfg.description}</span>
        </div>
      </div>
    </div>
  );
};
