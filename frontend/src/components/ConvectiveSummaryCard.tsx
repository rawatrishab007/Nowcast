// ============================================================
// WeatherNow AI — Multi-Hazard Risk Summary Engine Card
// ============================================================

import React from 'react';
import type { WeatherLocation, UnifiedHorizonForecast, HazardType } from '../types/weather';
import { SPATIAL_BOUNDS, FORECAST_HORIZONS } from '../constants';
import { HAZARD_CONFIG } from './PredictionControls';

interface ConvectiveSummaryCardProps {
  selectedLocation: WeatherLocation;
  horizonsData?: Record<string, UnifiedHorizonForecast>;
  selectedHorizon: number;
  selectedHazard: HazardType;
}

export const ConvectiveSummaryCard: React.FC<ConvectiveSummaryCardProps> = ({
  selectedLocation,
  horizonsData,
  selectedHorizon,
  selectedHazard,
}) => {
  const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;

  const row = Math.min(
    127,
    Math.max(0, Math.round(((maxLat - selectedLocation.lat) / (maxLat - minLat)) * 127))
  );
  const col = Math.min(
    127,
    Math.max(0, Math.round(((selectedLocation.lng - minLng) / (maxLng - minLng)) * 127))
  );

  const activeHorizonData = horizonsData?.[String(selectedHorizon)];
  const rainVal = activeHorizonData?.rain?.map?.[row]?.[col] ?? 0;
  const rainProbVal = activeHorizonData?.rain_probability?.map?.[row]?.[col] ?? 0;
  const convCloudVal = activeHorizonData?.convective_cloud?.map?.[row]?.[col] ?? 0;
  const lightningVal = activeHorizonData?.lightning?.map?.[row]?.[col] ?? 0;
  const tstormVal = activeHorizonData?.thunderstorm?.map?.[row]?.[col] ?? 0;

  // Peak horizon calculation for active hazard
  const horizonSeries = FORECAST_HORIZONS.map((h) => {
    const hData = horizonsData?.[String(h)];
    const hzLayer = hData ? (hData[selectedHazard] as any) : undefined;
    return {
      horizon: h,
      val: hzLayer?.map?.[row]?.[col] ?? 0,
    };
  });

  let peakHorizon = 30;
  let maxVal = -1;
  horizonSeries.forEach((s) => {
    if (s.val > maxVal) {
      maxVal = s.val;
      peakHorizon = s.horizon;
    }
  });

  // Risk Classification
  let riskLevel = 'Low';
  let badgeColor = 'bg-emerald-950/60 text-emerald-300 border-emerald-700/80';
  let riskDescription = 'Atmospheric conditions indicate calm to moderate convective activity.';

  if (rainVal >= 15 || convCloudVal >= 0.70 || lightningVal >= 0.60 || tstormVal >= 0.60) {
    riskLevel = 'Severe Convection';
    badgeColor = 'bg-rose-950/80 text-rose-300 border-rose-600 animate-pulse';
    riskDescription = 'High convective instability with significant storm and precipitation potential.';
  } else if (rainVal >= 5 || convCloudVal >= 0.40 || lightningVal >= 0.35 || tstormVal >= 0.35) {
    riskLevel = 'Elevated Risk';
    badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-600';
    riskDescription = 'Moderate instability detected across radar/satellite and NWP indicators.';
  }

  const hzCfg = HAZARD_CONFIG[selectedHazard];

  return (
    <div className="bg-gray-800/90 border border-gray-700/90 rounded-xl p-4 shadow-lg space-y-3.5 text-xs font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h3 className="font-bold text-white text-sm">Automated Risk Summary</h3>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">
          {selectedLocation.isCustom ? 'Custom Probe' : selectedLocation.name}
        </span>
      </div>

      {/* Signal Level Banner */}
      <div className="bg-gray-900/90 border border-gray-700/80 p-3 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-white font-bold text-sm tracking-tight">
            {riskLevel} Signal
          </span>
          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold font-mono ${badgeColor}`}>
            {riskLevel}
          </span>
        </div>

        {/* Dynamic Model Output Explanation */}
        <p className="text-gray-300 text-xs leading-relaxed">
          {riskDescription}
        </p>
        <span className="text-[10px] text-gray-400 font-mono block italic">
          Multi-Model Weather &amp; Severe Hazard Nowcast
        </span>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 font-mono">
        <div className="bg-gray-900/70 p-2.5 rounded-lg border border-gray-700/60">
          <span className="text-gray-400 text-[10px] block">Rain Nowcast (+{selectedHorizon}m)</span>
          <span className="text-teal-300 font-bold text-xs mt-0.5 block">
            {rainVal.toFixed(2)} mm/hr &bull; {(rainProbVal * 100).toFixed(0)}% prob
          </span>
        </div>
        <div className="bg-gray-900/70 p-2.5 rounded-lg border border-gray-700/60">
          <span className="text-gray-400 text-[10px] block">Peak {hzCfg.shortLabel} Horizon</span>
          <span className="text-white font-bold text-xs mt-0.5 block">
            +{peakHorizon} min{' '}
            <span className="text-teal-400">
              ({selectedHazard === 'rain' ? `${maxVal.toFixed(2)} mm/hr` : selectedHazard === 'convective_cloud' || selectedHazard === 'rain_probability' ? `${(maxVal * 100).toFixed(1)}%` : maxVal.toFixed(2)})
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
