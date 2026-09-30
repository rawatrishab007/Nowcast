// ============================================================
// WeatherNow AI — Strict Black + Blue + White Location Inspector
// ============================================================

import React from 'react';
import type { WeatherLocation, UnifiedHorizonForecast, HazardType } from '../types/weather';
import { LOCATIONS, SPATIAL_BOUNDS, FORECAST_HORIZONS } from '../constants';
import { HAZARD_CONFIG } from './PredictionControls';

interface LocationInspectorProps {
  selectedLocation: WeatherLocation;
  onLocationSelect: (location: WeatherLocation) => void;
  horizonsData?: Record<string, UnifiedHorizonForecast>;
  selectedHorizon: number;
  selectedHazard: HazardType;
}

export const LocationInspector: React.FC<LocationInspectorProps> = ({
  selectedLocation,
  onLocationSelect,
  horizonsData,
  selectedHorizon,
  selectedHazard,
}) => {
  const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;

  // Grid mapping for inspected coordinates
  const row = Math.min(
    127,
    Math.max(0, Math.round(((maxLat - selectedLocation.lat) / (maxLat - minLat)) * 127))
  );
  const col = Math.min(
    127,
    Math.max(0, Math.round(((selectedLocation.lng - minLng) / (maxLng - minLng)) * 127))
  );

  const activeHzCfg = HAZARD_CONFIG[selectedHazard];

  // Read active hazard across all 4 horizons
  const horizonValues = FORECAST_HORIZONS.map((h) => {
    const hData = horizonsData?.[String(h)];
    const hzLayer = hData ? (hData[selectedHazard] as any) : undefined;
    const val = hzLayer?.map?.[row]?.[col] ?? 0;
    return {
      horizon: h,
      val: val,
      unit: hzLayer?.unit || activeHzCfg.unit,
    };
  });

  const activeVal = horizonValues.find((v) => v.horizon === selectedHorizon)?.val ?? 0;

  // Read all 8 hazards for the selected horizon
  const activeHorizonData = horizonsData?.[String(selectedHorizon)];
  const allHazardsSummary = (Object.keys(HAZARD_CONFIG) as HazardType[]).map((hz) => {
    const hzLayer = activeHorizonData ? (activeHorizonData[hz] as any) : undefined;
    const val = hzLayer?.map?.[row]?.[col] ?? 0;
    const cfg = HAZARD_CONFIG[hz];
    return {
      key: hz,
      name: cfg.label,
      shortLabel: cfg.shortLabel,
      icon: cfg.icon,
      category: cfg.category,
      unit: cfg.unit,
      val: val,
    };
  });

  return (
    <div className="dark-card p-4 sm:p-5 rounded-2xl space-y-4 shadow-lg border border-[#383838]">
      {/* Header with Blue Heading & Station Dropdown */}
      <div className="flex items-center justify-between border-b border-[#383838] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{selectedLocation.isCustom ? '🎯' : '📍'}</span>
          <h3 className="font-bold text-blue-400 text-xs uppercase tracking-wider font-heading">
            Location Inspector
          </h3>
        </div>

        {/* Station Select */}
        <select
          value={selectedLocation.isCustom ? 'custom' : selectedLocation.id}
          onChange={(e) => {
            if (e.target.value === 'custom') return;
            const loc = LOCATIONS.find((l) => l.id === e.target.value);
            if (loc) onLocationSelect(loc);
          }}
          className="bg-[#212121] border border-[#383838] text-white text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[180px] truncate shadow-inner"
        >
          {selectedLocation.isCustom && (
            <option value="custom">📍 Probe: {selectedLocation.name}</option>
          )}
          {LOCATIONS.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}, {loc.state}
            </option>
          ))}
        </select>
      </div>

      {/* Selected Geographic Coordinates & Grid Mapping */}
      <div className="flex items-center justify-between bg-[#212121] p-3 rounded-xl border border-[#383838] text-xs">
        <div>
          <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider block font-heading">
            Inspected Point
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-white font-bold text-sm truncate max-w-[180px] font-heading">
              {selectedLocation.name}
            </span>
            {selectedLocation.isLoadingName && (
              <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin inline-block" title="Resolving..." />
            )}
          </div>
          {selectedLocation.state && (
            <div className="text-[11px] text-blue-300 font-semibold truncate max-w-[180px]">
              {selectedLocation.state}
            </div>
          )}
          <span className="text-neutral-400 text-[11px] font-mono block mt-0.5">
            {selectedLocation.lat.toFixed(3)}°N, {selectedLocation.lng.toFixed(3)}°E
          </span>
        </div>
        <div className="text-right">
          <span className="text-blue-400 text-[10px] font-bold uppercase tracking-wider block font-heading">
            AI Grid Cell
          </span>
          <span className="text-white font-bold font-mono text-sm block mt-0.5">
            [{row}, {col}]
          </span>
          <span className="text-[10px] text-neutral-400">128×128 (60km)</span>
        </div>
      </div>

      {/* Active Hazard Value Display */}
      <div className="bg-[#212121] border border-[#383838] p-3.5 rounded-xl flex items-center justify-between">
        <div>
          <span className="text-neutral-300 text-xs font-semibold block">
            {activeHzCfg.icon} {activeHzCfg.label} (+{selectedHorizon}m):
          </span>
          <span className="text-2xl font-black font-mono text-white mt-0.5 block tracking-tight font-heading">
            {selectedHazard === 'rain'
              ? `${activeVal.toFixed(2)} mm/hr`
              : selectedHazard === 'rain_probability' || selectedHazard === 'convective_cloud'
              ? `${(activeVal * 100).toFixed(1)}%`
              : `${activeVal.toFixed(3)}`}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full bg-[#181818] block uppercase tracking-wider">
            {activeHzCfg.modelBadge}
          </span>
        </div>
      </div>

      {/* Active Hazard Forecast Across Horizons */}
      <div>
        <span className="text-blue-400 text-[11px] uppercase tracking-wider font-bold block mb-2 font-heading">
          {activeHzCfg.shortLabel} Timeline (+30 to +120m):
        </span>
        <div className="grid grid-cols-4 gap-2 font-mono">
          {horizonValues.map((v) => {
            const isSelected = v.horizon === selectedHorizon;
            return (
              <div
                key={v.horizon}
                className={`p-2 rounded-xl text-center transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400'
                    : 'bg-[#212121] border border-[#383838] text-neutral-300 hover:border-neutral-500'
                }`}
              >
                <span className={`text-[10px] block font-bold ${isSelected ? 'text-blue-100' : 'text-neutral-400'}`}>
                  +{v.horizon}m
                </span>
                <span className="text-xs font-black block mt-0.5 text-white">
                  {selectedHazard === 'rain'
                    ? `${v.val.toFixed(1)}`
                    : selectedHazard === 'rain_probability' || selectedHazard === 'convective_cloud'
                    ? `${(v.val * 100).toFixed(0)}%`
                    : v.val.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8-Hazard Multi-Model Summary Matrix */}
      <div>
        <span className="text-blue-400 text-[11px] uppercase tracking-wider font-bold block mb-2 font-heading">
          8-Hazard Risk Matrix (+{selectedHorizon}m):
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {allHazardsSummary.map((h) => (
            <div
              key={h.key}
              className="bg-[#212121] border border-[#383838] p-2 rounded-xl flex items-center justify-between hover:border-neutral-500 transition-all"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-sm">{h.icon}</span>
                <span className="text-neutral-300 font-semibold truncate text-[11px]">{h.shortLabel}:</span>
              </div>
              <span className="text-white font-bold font-mono text-[11px] ml-1">
                {h.key === 'rain'
                  ? `${h.val.toFixed(1)} mm`
                  : h.key === 'rain_probability' || h.key === 'convective_cloud'
                  ? `${(h.val * 100).toFixed(0)}%`
                  : h.val.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
