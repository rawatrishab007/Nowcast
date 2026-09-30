import React, { useEffect } from 'react';
import type { UnifiedNowcastResponse, WeatherLocation } from '../types/weather';
import { SPATIAL_BOUNDS, FORECAST_HORIZONS } from '../constants';
import { extractPointValuesFromHorizon, evaluateDecisionSupportAlerts } from '../utils/alertEngine';
import { formatIstDateTime, formatIstTime, formatIstValidityWindow } from '../utils/timeUtils';

interface SituationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: UnifiedNowcastResponse | null;
  selectedLocation: WeatherLocation;
}

export const SituationReportModal: React.FC<SituationReportModalProps> = ({
  isOpen,
  onClose,
  prediction,
  selectedLocation,
}) => {
  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !prediction) return null;

  const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;
  const row = Math.min(127, Math.max(0, Math.round(((maxLat - selectedLocation.lat) / (maxLat - minLat)) * 127)));
  const col = Math.min(127, Math.max(0, Math.round(((selectedLocation.lng - minLng) / (maxLng - minLng)) * 127)));

  const generatedTimeStr = formatIstDateTime(new Date());
  const baseTimeStr = formatIstDateTime(prediction.base_time, 'N/A');

  const targetTimes = prediction.provenance?.target_times || {};
  const validWindowStr = formatIstValidityWindow(targetTimes['30'], targetTimes['120']);

  // Extract values across all 4 horizons
  const horizonTable = FORECAST_HORIZONS.map((h) => {
    const hData = prediction.horizons?.[String(h)];
    const vals = extractPointValuesFromHorizon(hData, row, col);
    const alerts = evaluateDecisionSupportAlerts(vals, h);
    return {
      horizon: h,
      targetTime: formatIstTime(hData?.target_time, `+${h}m`),
      vals,
      alerts,
    };
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-hidden print:p-0 print:bg-white print:static print:z-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="situation-report-root"
        className="relative bg-white text-gray-900 border border-gray-200 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans print:border-none print:shadow-none print:bg-white print:text-black print:max-h-none print:w-full"
      >
        {/* ── Modal Top Fixed Bar (Screen Only) ── */}
        <div className="bg-slate-100 px-5 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📄</span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-blue-700 tracking-tight font-heading">
                Meteorological Situation Assessment Report
              </h2>
              <p className="text-xs text-gray-600 font-medium">
                Operational Multi-Model Decision Support &bull; Megh Setu
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 hover:text-gray-900 text-xs font-bold cursor-pointer transition-all border border-gray-300"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* ── Scrollable Report Document Body (WHITE BACKGROUND) ── */}
        <div className="p-5 sm:p-8 space-y-6 text-gray-800 bg-white overflow-y-auto flex-1 print:p-0 print:overflow-visible">
          {/* Document Title & Header */}
          <div className="border-b-2 border-blue-600 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛰️</span>
                <span className="text-lg font-black tracking-tight text-gray-900 uppercase font-heading">
                  Megh Setu Nowcasting System
                </span>
              </div>
              <p className="text-xs text-blue-700 font-semibold mt-0.5">
                Operational Multi-Model Convective &amp; Precipitation Situation Briefing
              </p>
            </div>
            <div className="text-left sm:text-right text-xs font-mono text-gray-500 shrink-0">
              <div>Generated: <strong className="text-gray-900">{generatedTimeStr}</strong></div>
              <div>Report ID: MS-SITREP-{Date.now().toString().slice(-6)}</div>
            </div>
          </div>

          {/* Section 1: Location & Target Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-gray-200 print:bg-gray-100 print:border-gray-300">
            <div>
              <span className="text-blue-700 text-[10px] uppercase font-bold block font-heading">
                Inspected Location / Grid Point
              </span>
              <span className="text-sm font-bold text-gray-900 block mt-0.5 font-heading">
                {selectedLocation.isCustom ? '🎯 ' : '📍 '}
                {selectedLocation.name}
              </span>
              <div className="text-xs text-gray-600 mt-1 font-mono">
                Coordinates: {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lng.toFixed(4)}°E (Cell [{row}, {col}])
              </div>
              {selectedLocation.state && (
                <div className="text-xs text-blue-700 mt-0.5 font-semibold">
                  Region: {selectedLocation.state}
                </div>
              )}
            </div>

            <div className="sm:text-right">
              <span className="text-blue-700 text-[10px] uppercase font-bold block font-heading">
                Timing &amp; Validity Window
              </span>
              <div className="text-xs text-gray-600 mt-0.5">
                Observation Time (t₀): <span className="font-bold text-gray-900 font-mono">{baseTimeStr}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Valid Horizon: <span className="font-bold text-blue-700 font-mono">{validWindowStr}</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Domain: Indian Subcontinent (8°N–38°N, 68°E–98°E)</div>
            </div>
          </div>

          {/* Section 2: 4-Horizon Quantitative Forecast Matrix */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-blue-700 uppercase font-heading tracking-wider">
              1. Multi-Horizon Quantitative Forecast Matrix (128×128 AI Grid)
            </h4>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-gray-700 border-b border-gray-200 font-heading">
                    <th className="p-3">Horizon</th>
                    <th className="p-3">Target Time</th>
                    <th className="p-3">Rain Rate</th>
                    <th className="p-3">Rain Prob</th>
                    <th className="p-3">Cold Cloud P(&lt;235K)</th>
                    <th className="p-3">Lightning Risk</th>
                    <th className="p-3">Hail Risk</th>
                    <th className="p-3">Cloudburst Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-xs">
                  {horizonTable.map((rowItem) => (
                    <tr key={rowItem.horizon} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-3 font-bold text-blue-700 font-sans">+{rowItem.horizon}m</td>
                      <td className="p-3 text-gray-700">{rowItem.targetTime}</td>
                      <td className="p-3 font-bold text-gray-900">{rowItem.vals.rain.toFixed(2)} mm/hr</td>
                      <td className="p-3 text-gray-700">{(rowItem.vals.rain_probability * 100).toFixed(0)}%</td>
                      <td className="p-3 text-blue-800 font-semibold">{rowItem.vals.convective_cloud.toFixed(2)}</td>
                      <td className="p-3 text-blue-800 font-semibold">{rowItem.vals.lightning.toFixed(2)}</td>
                      <td className="p-3 text-blue-800 font-semibold">{rowItem.vals.hail.toFixed(2)}</td>
                      <td className="p-3 text-blue-800 font-semibold">{rowItem.vals.cloudburst.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Active Decision-Support Risk Indicators */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-blue-700 uppercase font-heading tracking-wider">
              2. Decision-Support Risk Indicators &amp; Triggers
            </h4>
            <div className="space-y-2 text-xs">
              {horizonTable.flatMap((h) => h.alerts).length === 0 ? (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-200 text-gray-600">
                  No automated critical thresholds exceeded across the 2-hour forecast timeline.
                </div>
              ) : (
                horizonTable.flatMap((h) => h.alerts).map((alert, idx) => {
                  const isCritical = alert.severity_level === 'critical' || alert.severity_level === 'high';
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                        isCritical
                          ? 'bg-red-50 border-red-300 text-red-950'
                          : 'bg-blue-50/40 border-blue-200 text-gray-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold font-heading ${isCritical ? 'text-red-900' : 'text-gray-900'}`}>
                            {alert.indicator_title}
                          </span>
                          <span className="text-[11px] text-blue-700 font-mono">({alert.lead_time_min}m)</span>
                        </div>
                        <div className="text-xs text-gray-700 mt-1">{alert.description}</div>
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5">Rule: {alert.trigger_rule} &bull; Model: {alert.source_model}</div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-heading ${
                          isCritical
                            ? 'bg-red-600 text-white'
                            : 'bg-blue-700 text-white'
                        }`}
                      >
                        {alert.severity_level}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 4: Data Sources & Model Provenance */}
          <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-xl border border-gray-200">
            <h4 className="text-xs font-bold text-blue-700 uppercase font-heading">
              3. Data Sources &amp; Model Provenance
            </h4>
            <ul className="list-disc pl-4 space-y-1.5 text-gray-700 text-xs">
              <li>
                <strong className="text-gray-900">Atmospheric Data Sources:</strong> NOAA Himawari-9 AHI Band 13 Satellite scans (10.4µm) + NOAA GFS 0.25° NWP fields (t2m, d2m, u10, v10, cape, cin, tp).
              </li>
              <li>
                <strong className="text-gray-900">V4 Rainfall Nowcast:</strong> SIHV4RainfallNowcast (93,208 parameters) trained on IMERG precipitation benchmarks.
              </li>
              <li>
                <strong className="text-gray-900">V3 Convective Cloud:</strong> SIHV3Nowcast (200,996 parameters) predicting cold-cloud deep convection proxy P(B13 &lt; 235 K).
              </li>
              <li>
                <strong className="text-gray-900">V1 Severe Weather Assessment:</strong> Severe proxy risk scores derived from thermodynamic profiles.
              </li>
            </ul>
          </div>

          {/* Section 5: Mandatory Scientific Disclaimer Banner */}
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs leading-relaxed">
            <strong className="text-amber-800 font-bold">⚠️ MANDATORY SCIENTIFIC LIMITATION NOTICE:</strong>
            <br />
            Lightning, thunderstorm, hail, cloudburst and downburst values are proxy risk scores ([0.0 - 1.0]) derived from atmospheric profiles and are NOT calibrated observational probabilities. This document is generated by Megh Setu as a meteorological decision-support tool and is NOT an official government weather warning.
          </div>
        </div>
      </div>
    </div>
  );
};
