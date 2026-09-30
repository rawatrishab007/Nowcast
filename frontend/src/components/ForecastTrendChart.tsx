// ============================================================
// WeatherNow AI — Strict Black + Blue + White Forecast Trend Card
// Structure: Title (Blue) -> Chart -> Evenly spaced Horizons (+30, +60, +90, +120)
// ============================================================

import React, { useState } from 'react';
import type { UnifiedHorizonForecast, HazardType, WeatherLocation } from '../types/weather';
import { FORECAST_HORIZONS, SPATIAL_BOUNDS } from '../constants';
import { extractPointValuesFromHorizon } from '../utils/alertEngine';
import { HAZARD_CONFIG } from './PredictionControls';

interface ForecastTrendChartProps {
  selectedLocation: WeatherLocation;
  horizonsData?: Record<string, UnifiedHorizonForecast>;
  selectedHorizon: number;
  onHorizonSelect: (horizon: number) => void;
}

export const ForecastTrendChart: React.FC<ForecastTrendChartProps> = ({
  selectedLocation,
  horizonsData,
  selectedHorizon,
  onHorizonSelect,
}) => {
  const [activeMetric, setActiveMetric] = useState<HazardType>('rain');

  const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;
  const row = Math.min(127, Math.max(0, Math.round(((maxLat - selectedLocation.lat) / (maxLat - minLat)) * 127)));
  const col = Math.min(127, Math.max(0, Math.round(((selectedLocation.lng - minLng) / (maxLng - minLng)) * 127)));

  // Extract values across all 4 horizons
  const seriesData = FORECAST_HORIZONS.map((h) => {
    const hData = horizonsData?.[String(h)];
    const vals = extractPointValuesFromHorizon(hData, row, col);
    const v = vals[activeMetric] ?? 0;
    return {
      horizon: h,
      val: v,
      targetTime: hData?.target_time,
    };
  });

  const cfg = HAZARD_CONFIG[activeMetric];
  const maxValInSeries = Math.max(...seriesData.map((d) => d.val), 0.01);
  const chartHeight = 110;
  const chartWidth = 360;
  const paddingX = 45;
  const paddingY = 22;

  // Compute SVG Points with stable coordinates
  const points = seriesData.map((d, i) => {
    const x = paddingX + (i / (seriesData.length - 1)) * (chartWidth - paddingX * 2);
    const normalizedY = d.val / (maxValInSeries * 1.25 || 1);
    const y = chartHeight - paddingY - normalizedY * (chartHeight - paddingY * 2);
    return { x, y, ...d };
  });

  const svgPolyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="dark-card p-4 sm:p-5 rounded-2xl space-y-3.5 shadow-lg border border-[#383838] flex flex-col justify-between h-full min-h-[340px]">
      {/* ── 1. Header (Blue Heading) ── */}
      <div className="flex items-center justify-between border-b border-[#383838] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📈</span>
          <h3 className="font-bold text-blue-400 text-xs uppercase tracking-wider font-heading">
            Forecast Trend
          </h3>
        </div>

        {/* Metric Selector Dropdown */}
        <select
          value={activeMetric}
          onChange={(e) => setActiveMetric(e.target.value as HazardType)}
          className="bg-[#212121] border border-[#383838] text-white text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-inner max-w-[170px] truncate"
        >
          {(Object.keys(HAZARD_CONFIG) as HazardType[]).map((hz) => (
            <option key={hz} value={hz}>
              {HAZARD_CONFIG[hz].icon} {HAZARD_CONFIG[hz].shortLabel} ({HAZARD_CONFIG[hz].unit})
            </option>
          ))}
        </select>
      </div>

      {/* ── 2. Main Chart Canvas Area ── */}
      <div className="flex-1 bg-[#212121] rounded-xl p-3 border border-[#383838] flex flex-col justify-center">
        <div className="w-full">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-28 overflow-visible">
            {/* Subtle Grid Lines */}
            <line x1={paddingX - 10} y1={paddingY} x2={chartWidth - paddingX + 10} y2={paddingY} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" strokeWidth="1" />
            <line x1={paddingX - 10} y1={chartHeight / 2} x2={chartWidth - paddingX + 10} y2={chartHeight / 2} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" strokeWidth="1" />
            <line x1={paddingX - 10} y1={chartHeight - paddingY} x2={chartWidth - paddingX + 10} y2={chartHeight - paddingY} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />

            {/* Area under curve */}
            <polygon
              points={`${paddingX},${chartHeight - paddingY} ${svgPolyline} ${chartWidth - paddingX},${chartHeight - paddingY}`}
              fill="url(#strictBlueTrendGradient)"
              opacity="0.25"
            />

            {/* Primary Blue Trend Line */}
            <polyline
              points={svgPolyline}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <defs>
              <linearGradient id="strictBlueTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizon Nodes & White Data Labels */}
            {points.map((p) => {
              const isSelected = p.horizon === selectedHorizon;
              return (
                <g key={p.horizon} onClick={() => onHorizonSelect(p.horizon)} className="cursor-pointer">
                  {isSelected && (
                    <circle cx={p.x} cy={p.y} r="8" fill="#3B82F6" opacity="0.35" className="animate-ping" />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? '6' : '4.5'}
                    fill={isSelected ? '#60A5FA' : '#3B82F6'}
                    stroke="#FFFFFF"
                    strokeWidth={isSelected ? '2' : '1.2'}
                  />
                  {/* Floating White Value text with stable vertical alignment */}
                  <text
                    x={p.x}
                    y={Math.max(14, p.y - 10)}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {activeMetric === 'rain'
                      ? `${p.val.toFixed(1)}`
                      : activeMetric === 'rain_probability' || activeMetric === 'convective_cloud'
                      ? `${(p.val * 100).toFixed(0)}%`
                      : p.val.toFixed(2)}
                  </text>
                  {/* Horizon X-axis label (+30, +60, +90, +120) */}
                  <text
                    x={p.x}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    fill={isSelected ? '#60A5FA' : '#A3A3A3'}
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                  >
                    +{p.horizon}m
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── 3. Bottom Summary (Evenly spaced & aligned) ── */}
      <div className="flex items-center justify-between text-xs text-neutral-400 pt-3 border-t border-[#383838]">
        <div className="truncate max-w-[190px]">
          <span className="text-neutral-500">Location: </span>
          <span className="text-white font-semibold">{selectedLocation.name}</span>
        </div>
        <div>
          <span className="text-neutral-500">Model: </span>
          <span className="text-blue-400 font-semibold font-mono">{cfg.modelBadge}</span>
        </div>
      </div>
    </div>
  );
};
