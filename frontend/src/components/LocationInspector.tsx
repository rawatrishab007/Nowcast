// ============================================================
// WeatherNow AI — Station & Point Inspector Component
// Multi-Model Hazard Inspection at Inspected Coordinate [r, c]
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
    <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-4 shadow-lg space-y-3.5 text-xs font-sans">
      {/* Header with City Dropdown / Custom Probe Indicator */}
      <div className="flex items-center justify-between border-b border-gray-700/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">📍</span>
          <h3 className="font-bold text-white text-sm">Station Inspector</h3>
        </div>

        {/* Station Select */}
        <select
          value={selectedLocation.isCustom ? 'custom' : selectedLocation.id}
          onChange={(e) => {
            if (e.target.value === 'custom') return;
            const loc = LOCATIONS.find((l) => l.id === e.target.value);
            if (loc) onLocationSelect(loc);
          }}
          className="bg-gray-900 border border-gray-700 text-teal-300 text-xs font-mono font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-teal-500 cursor-pointer max-w-[180px] truncate"
        >
          {selectedLocation.isCustom && (
            <option value="custom">Custom Map Point</option>
          )}
          {LOCATIONS.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}, {loc.state}
            </option>
          ))}
        </select>
      </div>

      {/* Selected Geographic Coordinates & Grid Mapping */}
      <div className="flex items-center justify-between bg-gray-900/60 p-2.5 rounded-lg border border-gray-700/60 font-mono text-[11px]">
        <div>
          <span className="text-gray-400 text-[10px] block">Inspected Location:</span>
          <span className="text-white font-semibold">
            {selectedLocation.name}
            {selectedLocation.state ? ` (${selectedLocation.state})` : ''}
          </span>
          <span className="text-gray-400 text-[10px] block mt-0.5">
            {selectedLocation.lat.toFixed(3)}°N, {selectedLocation.lng.toFixed(3)}°E
          </span>
        </div>
        <div className="text-right">
          <span className="text-gray-400 text-[10px] block">128×128 Grid Cell:</span>
          <span className="text-teal-300 font-semibold block mt-0.5">
            [{row}, {col}]
          </span>
        </div>
      </div>

      {/* Active Hazard Value Display */}
      <div className="bg-gray-900/90 border border-teal-900/80 p-3 rounded-lg flex items-center justify-between">
        <div>
          <span className="text-gray-400 text-[10px] block font-mono">
            {activeHzCfg.icon} {activeHzCfg.label} (+{selectedHorizon}m):
          </span>
          <span className="text-2xl font-black font-mono text-teal-400">
            {selectedHazard === 'rain'
              ? `${activeVal.toFixed(2)} mm/hr`
              : selectedHazard === 'rain_probability' || selectedHazard === 'convective_cloud'
              ? `${(activeVal * 100).toFixed(1)}%`
              : `${activeVal.toFixed(3)} (score)`}
          </span>
        </div>
        <div className="text-right font-mono">
          <span className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded bg-gray-800 block">
            {activeHzCfg.modelBadge}
          </span>
        </div>
      </div>

      {/* Active Hazard Forecast Across Horizons */}
      <div>
        <span className="text-gray-400 text-[10px] uppercase tracking-wider font-mono font-bold block mb-1.5">
          {activeHzCfg.shortLabel} Timeline (+30 to +120m):
        </span>
        <div className="grid grid-cols-4 gap-2 font-mono">
          {horizonValues.map((v) => {
            const isSelected = v.horizon === selectedHorizon;
            return (
              <div
                key={v.horizon}
                className={`p-2 rounded-lg border text-center transition-all ${
                  isSelected
                    ? 'bg-teal-950/80 border-teal-500 shadow-md ring-1 ring-teal-500/50'
                    : 'bg-gray-900/70 border-gray-700/60'
                }`}
              >
                <span className="text-[10px] text-gray-400 block font-semibold">
                  +{v.horizon}m
                </span>
                <span
                  className={`text-xs font-bold block mt-0.5 ${
                    isSelected ? 'text-teal-300' : 'text-gray-200'
                  }`}
                >
                  {selectedHazard === 'rain'
                    ? `${v.val.toFixed(2)}`
                    : selectedHazard === 'rain_probability' || selectedHazard === 'convective_cloud'
                    ? `${(v.val * 100).toFixed(1)}%`
                    : v.val.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8-Hazard Multi-Model Summary Matrix */}
      <div>
        <span className="text-gray-400 text-[10px] uppercase tracking-wider font-mono font-bold block mb-1.5">
          Multi-Hazard Matrix (+{selectedHorizon}m):
        </span>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
          {allHazardsSummary.map((h) => (
            <div
              key={h.key}
              className="bg-gray-900/80 border border-gray-700/60 p-1.5 rounded flex items-center justify-between"
            >
              <div className="flex items-center gap-1 truncate">
                <span>{h.icon}</span>
                <span className="text-gray-300 font-semibold truncate">{h.shortLabel}:</span>
              </div>
              <span className="text-teal-300 font-bold ml-1">
                {h.key === 'rain'
                  ? `${h.val.toFixed(2)} mm`
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
