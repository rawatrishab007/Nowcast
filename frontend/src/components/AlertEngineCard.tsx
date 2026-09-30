// ============================================================
// WeatherNow AI — Strict Black + Blue + White Alert Engine Card
// (Red strictly reserved for Critical Alerts & Severe Warnings)
// ============================================================

import React from 'react';
import type { WeatherLocation, UnifiedHorizonForecast } from '../types/weather';
import { SPATIAL_BOUNDS, FORECAST_HORIZONS } from '../constants';
import { extractPointValuesFromHorizon, evaluateDecisionSupportAlerts } from '../utils/alertEngine';

interface AlertEngineCardProps {
  selectedLocation: WeatherLocation;
  horizonsData?: Record<string, UnifiedHorizonForecast>;
  selectedHorizon: number;
}

export const AlertEngineCard: React.FC<AlertEngineCardProps> = ({
  selectedLocation,
  horizonsData,
  selectedHorizon,
}) => {
  const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;
  const row = Math.min(127, Math.max(0, Math.round(((maxLat - selectedLocation.lat) / (maxLat - minLat)) * 127)));
  const col = Math.min(127, Math.max(0, Math.round(((selectedLocation.lng - minLng) / (maxLng - minLng)) * 127)));

  const activeHorizonData = horizonsData?.[String(selectedHorizon)];
  const pointVals = extractPointValuesFromHorizon(activeHorizonData, row, col);
  const activeAlerts = evaluateDecisionSupportAlerts(pointVals, selectedHorizon);

  // Check all 4 horizons for any upcoming severe alerts
  const upcomingAlertCount = FORECAST_HORIZONS.reduce((acc, h) => {
    const hData = horizonsData?.[String(h)];
    const vals = extractPointValuesFromHorizon(hData, row, col);
    const alerts = evaluateDecisionSupportAlerts(vals, h);
    return acc + alerts.length;
  }, 0);

  const hasCriticalAlert = activeAlerts.some((a) => a.severity_level === 'critical' || a.severity_level === 'high');

  return (
    <div className={`dark-card p-4 sm:p-5 rounded-2xl space-y-3.5 shadow-lg border border-[#383838] ${hasCriticalAlert ? 'border-red-600 shadow-alert-glow' : ''}`}>
      {/* ── 1. Header (Blue Heading) ── */}
      <div className="flex items-center justify-between border-b border-[#383838] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{hasCriticalAlert ? '🚨' : '🛡️'}</span>
          <div>
            <h3 className="font-bold text-blue-400 text-xs uppercase tracking-wider font-heading">
              Decision-Support Risk Engine
            </h3>
            <span className="text-[11px] text-neutral-400 font-medium">Rule-Based Meteorological Thresholds</span>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border font-heading ${
            hasCriticalAlert
              ? 'bg-red-600 text-white border-red-500 animate-pulse'
              : 'bg-[#212121] text-blue-400 border border-[#383838]'
          }`}
        >
          {activeAlerts.length} Active Indicator{activeAlerts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* ── 2. Active Alerts List ── */}
      {activeAlerts.length === 0 ? (
        <div className="bg-[#212121] border border-[#383838] p-3.5 rounded-xl flex items-center gap-3 text-neutral-300">
          <span className="text-blue-400 text-xl font-black">✓</span>
          <div>
            <div className="font-bold text-white text-xs font-heading">No Critical Thresholds Exceeded</div>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              Current model indicators at +{selectedHorizon}m remain below decision-support action levels.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeAlerts.map((alert) => {
            const isCritical = alert.severity_level === 'critical';
            const isHigh = alert.severity_level === 'high';
            const isRedAlert = isCritical || isHigh;

            return (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border space-y-2 ${
                  isRedAlert
                    ? 'bg-red-950/80 border-red-600 text-red-100 shadow-md shadow-red-950/80'
                    : 'bg-[#212121] border-[#383838] text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{isRedAlert ? '🚨' : 'ℹ️'}</span>
                    <span className="font-bold text-white text-xs font-heading">{alert.indicator_title}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      isRedAlert
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {alert.severity_level}
                  </span>
                </div>

                <p className="text-xs text-neutral-200 leading-snug font-normal">{alert.description}</p>

                {/* Rule transparency */}
                <div className="text-[10px] text-neutral-300 bg-[#181818] p-2 rounded-lg border border-[#383838] font-mono">
                  <span className="text-neutral-400 font-sans font-medium">Trigger Rule: </span>
                  <span className="text-blue-300 font-bold">{alert.trigger_rule}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. Operational Timeline Alert Summary ── */}
      <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-[#383838] font-medium">
        <span>Full Timeline (30–120m):</span>
        <span className="text-blue-400 font-bold font-mono">{upcomingAlertCount} total indicators evaluated</span>
      </div>
    </div>
  );
};
