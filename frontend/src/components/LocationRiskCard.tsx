// ============================================================
// WeatherNow AI — Strict Black + Blue + White Location Risk Card
// ============================================================

import React from 'react';
import type { WeatherLocation, UnifiedHorizonForecast, HazardType } from '../types/weather';
import { SPATIAL_BOUNDS } from '../constants';
import { extractPointValuesFromHorizon } from '../utils/alertEngine';
import { formatIstTime } from '../utils/timeUtils';

interface LocationRiskCardProps {
  selectedLocation: WeatherLocation;
  horizonsData?: Record<string, UnifiedHorizonForecast>;
  selectedHorizon: number;
  onHorizonSelect?: (horizon: number) => void;
  selectedHazard: HazardType;
  onHazardSelect: (hazard: HazardType) => void;
}

export const LocationRiskCard: React.FC<LocationRiskCardProps> = ({
  selectedLocation,
  horizonsData,
  selectedHorizon,
  selectedHazard,
  onHazardSelect,
}) => {
  const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;

  const row = Math.min(127, Math.max(0, Math.round(((maxLat - selectedLocation.lat) / (maxLat - minLat)) * 127)));
  const col = Math.min(127, Math.max(0, Math.round(((selectedLocation.lng - minLng) / (maxLng - minLng)) * 127)));

  const activeHorizonData = horizonsData?.[String(selectedHorizon)];
  const currentVals = extractPointValuesFromHorizon(activeHorizonData, row, col);

  const validTimeStr = formatIstTime(activeHorizonData?.target_time, `+${selectedHorizon}m`);

  return (
    <div className="dark-card p-4 sm:p-5 rounded-2xl space-y-4 shadow-lg border border-[#383838]">
      {/* ── 1. Header & Location Identity (Blue Heading) ── */}
      <div className="flex items-start justify-between border-b border-[#383838] pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{selectedLocation.isCustom ? '🎯' : '📍'}</span>
            <h3 className="font-bold text-white text-sm tracking-tight truncate max-w-[200px] font-heading">
              {selectedLocation.name}
            </h3>
            {selectedLocation.isLoadingName && (
              <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin inline-block" title="Resolving location..." />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <span>
              {selectedLocation.lat.toFixed(3)}°N, {selectedLocation.lng.toFixed(3)}°E
            </span>
            <span className="text-blue-400 font-semibold">&bull; Cell [{row}, {col}]</span>
          </div>
          {selectedLocation.state && (
            <div className="text-[11px] text-blue-300 font-semibold truncate max-w-[220px]">
              {selectedLocation.state}
            </div>
          )}
        </div>

        {/* Custom Probe vs Station Badge */}
        {selectedLocation.isCustom ? (
          <span className="px-2.5 py-1 rounded-full bg-[#181818] text-blue-300 border border-blue-500/30 text-[10px] font-bold font-heading">
            Map Probe
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-[#212121] text-neutral-300 border border-[#383838] text-[10px] font-bold font-heading">
            Station
          </span>
        )}
      </div>

      {/* ── 2. Active Horizon Indicator ── */}
      <div className="bg-[#212121] p-3 rounded-xl border border-[#383838] flex items-center justify-between text-xs">
        <div>
          <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider block font-heading">Forecast Horizon</span>
          <span className="text-white font-black text-sm block font-heading">+{selectedHorizon} min lead</span>
        </div>
        <div className="text-right">
          <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider block font-heading">Valid Time (IST)</span>
          <span className="text-white font-bold font-mono text-xs block">{validTimeStr}</span>
        </div>
      </div>

      {/* ── 3. Neural Nowcasts (V4 & V3) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] uppercase font-bold text-blue-400 font-heading tracking-wider">
          <span>Neural Nowcasting Outputs</span>
          <span className="text-neutral-300 font-mono">V4 &amp; V3 Models</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Rainfall Rate */}
          <button
            onClick={() => onHazardSelect('rain')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
              selectedHazard === 'rain'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border-blue-400'
                : 'bg-[#212121] border-[#383838] text-neutral-300 hover:border-neutral-500'
            }`}
          >
            <div className={`text-[10px] font-semibold truncate ${selectedHazard === 'rain' ? 'text-blue-100' : 'text-neutral-400'}`}>🌧️ Rain Rate</div>
            <div className="text-base font-black font-mono mt-0.5 text-white">
              {currentVals.rain.toFixed(2)}
            </div>
            <div className={`text-[9px] font-mono ${selectedHazard === 'rain' ? 'text-blue-100' : 'text-neutral-400'}`}>mm/hr</div>
          </button>

          {/* Rain Probability */}
          <button
            onClick={() => onHazardSelect('rain_probability')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
              selectedHazard === 'rain_probability'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border-blue-400'
                : 'bg-[#212121] border-[#383838] text-neutral-300 hover:border-neutral-500'
            }`}
          >
            <div className={`text-[10px] font-semibold truncate ${selectedHazard === 'rain_probability' ? 'text-blue-100' : 'text-neutral-400'}`}>☔ Rain Occur.</div>
            <div className="text-base font-black font-mono mt-0.5 text-white">
              {(currentVals.rain_probability * 100).toFixed(0)}%
            </div>
            <div className={`text-[9px] font-mono ${selectedHazard === 'rain_probability' ? 'text-blue-100' : 'text-neutral-400'}`}>Probability</div>
          </button>

          {/* Convective Cloud */}
          <button
            onClick={() => onHazardSelect('convective_cloud')}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
              selectedHazard === 'convective_cloud'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border-blue-400'
                : 'bg-[#212121] border-[#383838] text-neutral-300 hover:border-neutral-500'
            }`}
          >
            <div className={`text-[10px] font-semibold truncate ${selectedHazard === 'convective_cloud' ? 'text-blue-100' : 'text-neutral-400'}`}>☁️ Cold Cloud</div>
            <div className="text-base font-black font-mono mt-0.5 text-white">
              {currentVals.convective_cloud.toFixed(2)}
            </div>
            <div className={`text-[9px] font-mono ${selectedHazard === 'convective_cloud' ? 'text-blue-100' : 'text-neutral-400'}`}>P(B13&lt;235K)</div>
          </button>
        </div>
      </div>

      {/* ── 4. Severe Hazard Proxies (V1) ── */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] uppercase font-bold text-blue-400 font-heading tracking-wider">
          <span>Severe Weather Assessment</span>
          <span className="text-neutral-300 font-mono">V1 Model [0.0 - 1.0]</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            { key: 'lightning' as HazardType, label: 'Lightning', icon: '⚡', val: currentVals.lightning },
            { key: 'thunderstorm' as HazardType, label: 'Thunderstorm', icon: '⛈️', val: currentVals.thunderstorm },
            { key: 'hail' as HazardType, label: 'Hail', icon: '🧊', val: currentVals.hail },
            { key: 'cloudburst' as HazardType, label: 'Cloudburst', icon: '🌊', val: currentVals.cloudburst },
            { key: 'downburst' as HazardType, label: 'Downburst', icon: '💨', val: currentVals.downburst },
          ].map((item) => {
            const isSelected = selectedHazard === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onHazardSelect(item.key)}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border-blue-400'
                    : 'bg-[#212121] border-[#383838] text-neutral-300 hover:border-neutral-500'
                }`}
              >
                <span className="truncate text-[11px] font-semibold">{item.icon} {item.label}:</span>
                <span className="font-black font-mono text-[11px] ml-1 text-white">
                  {item.val.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 5. Scientific Disclaimer Note ── */}
      <p className="text-[10px] text-neutral-400 leading-tight italic pt-2 border-t border-[#383838]">
        * Lightning, thunderstorm, hail, cloudburst and downburst are severe weather proxy risk scores ([0.0 - 1.0]), not calibrated observational probabilities.
      </p>
    </div>
  );
};
