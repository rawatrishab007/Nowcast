import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import Page from '../components/common/Page';
import Card from '../components/common/Card';
import PredictionChart from '../components/charts/PredictionChart';
import { LOCATIONS, CONDITION_ICONS } from '../constants';
import type { CurrentWeather, NowcastPrediction } from '../types/weather';
import { getCurrentWeather, getNowcast } from '../services/weatherApi';

const NowcastPage: React.FC = () => {
  const [locationId, setLocationId] = useState('dehradun');
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [nowcast, setNowcast] = useState<NowcastPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [cur, nc] = await Promise.all([
      getCurrentWeather(locationId),
      getNowcast(locationId),
    ]);
    setCurrent(cur);
    setNowcast(nc);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);

  const confidenceData = nowcast?.predictions.map(s => ({
    time: s.label,
    confidence: s.confidence,
  })) ?? [];

  return (
    <Page title="Nowcast Predictions">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-gray-800 p-4 rounded-xl border border-gray-700/80 shadow-md">
        <div className="flex items-center gap-3">
          <select
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}, {l.state}</option>)}
          </select>
          <span className="text-xs bg-teal-900/40 border border-teal-700 text-teal-300 px-3 py-1.5 rounded-full">
            🤖 AI Model · 0–120 min horizon
          </span>
        </div>
        <button onClick={loadData} className="text-xs bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-lg px-3 py-1.5 transition-colors">
          ↺ Refresh
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-40">
          <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {!loading && current && nowcast && (
        <>
          {/* Current observation summary */}
          <Card title="">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white text-lg font-bold">Current Sensor Observation</h3>
                <p className="text-gray-400 text-sm">{LOCATIONS.find(l => l.id === locationId)?.name} · {new Date(current.timestamp).toLocaleTimeString('en-IN')}</p>
              </div>
              <div className="flex items-center gap-2 bg-teal-900/40 border border-teal-700 px-3 py-2 rounded-xl">
                <span className="text-3xl">{CONDITION_ICONS[current.condition] ?? '🌡️'}</span>
                <div>
                  <p className="text-white font-bold">{current.condition}</p>
                  <p className="text-teal-300 text-sm font-semibold">{current.rainfall} mm/hr</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
              {[
                { label: 'Temp', value: `${current.temperature}°C`, color: 'text-orange-400' },
                { label: 'Humidity', value: `${current.humidity}%`, color: 'text-blue-400' },
                { label: 'Rainfall', value: `${current.rainfall} mm/h`, color: 'text-teal-400' },
                { label: 'Wind', value: `${current.windSpeed} km/h`, color: 'text-cyan-400' },
                { label: 'Visibility', value: `${current.visibility} km`, color: 'text-purple-400' },
                { label: 'Pressure', value: `${current.pressure} hPa`, color: 'text-gray-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-700/50 rounded-lg p-2.5 border border-gray-700">
                  <p className="text-gray-400 text-xs">{label}</p>
                  <p className={`font-bold text-sm mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Prediction timeline table */}
          <Card title="">
            <h3 className="text-white font-bold text-lg mb-1">Model Prediction Timeline</h3>
            <p className="text-gray-400 text-xs mb-4">AI generated short-term forecast intervals · Confidence bounds included</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                    <th className="py-2.5 px-3 text-left">Horizon</th>
                    <th className="py-2.5 px-3 text-left">Condition</th>
                    <th className="py-2.5 px-3 text-right">Predicted Rain</th>
                    <th className="py-2.5 px-3 text-right">Confidence Bound</th>
                    <th className="py-2.5 px-3 text-right">Temp</th>
                    <th className="py-2.5 px-3 text-right">Wind</th>
                    <th className="py-2.5 px-3 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {nowcast.predictions.map(step => {
                    const isNow = step.minutesAhead === 0;
                    const rainfall = step.rainfall;
                    const intensityColor =
                      rainfall > 40 ? 'text-red-400' :
                      rainfall > 20 ? 'text-orange-400' :
                      rainfall > 8  ? 'text-yellow-400' :
                      rainfall > 0  ? 'text-green-400' : 'text-teal-400';
                    return (
                      <tr key={step.minutesAhead}
                        className={`border-b border-gray-700/60 last:border-0 transition-colors ${isNow ? 'bg-teal-900/20' : 'hover:bg-gray-700/30'}`}
                      >
                        <td className="py-3 px-3">
                          <span className={`font-bold ${isNow ? 'text-teal-400' : 'text-white'}`}>{step.label}</span>
                          {isNow && <span className="ml-2 text-xs bg-teal-700 text-white px-1.5 py-0.5 rounded font-medium">OBS</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span className="flex items-center gap-1.5">
                            <span>{CONDITION_ICONS[step.condition] ?? '🌡️'}</span>
                            <span className="text-gray-300">{step.condition}</span>
                          </span>
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${intensityColor}`}>
                          {step.rainfall.toFixed(1)}<span className="text-xs text-gray-400 ml-0.5">mm/h</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-gray-400">
                          [{step.lowerBound.toFixed(1)} - {step.upperBound.toFixed(1)}]
                        </td>
                        <td className="py-3 px-3 text-right text-orange-300">{step.temperature}°C</td>
                        <td className="py-3 px-3 text-right text-cyan-300">{step.windSpeed} km/h</td>
                        <td className="py-3 px-3 text-right">
                          {isNow ? (
                            <span className="text-teal-400 font-bold">Observed</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${step.confidence}%` }} />
                              </div>
                              <span className="text-gray-300 font-mono text-xs w-8 text-right">{step.confidence}%</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Prediction Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="">
              <PredictionChart
                observations={nowcast.observations}
                predictions={nowcast.predictions}
              />
            </Card>

            <Card title="">
              <h3 className="text-white font-semibold mb-4">Prediction Confidence Decay Curve</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={confidenceData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(val: number) => [`${val}%`, 'Confidence']} />
                    <Line type="monotone" dataKey="confidence" name="Confidence (%)"
                      stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 4, fill: '#a78bfa' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-gray-400 text-xs mt-2">AI model confidence decreases as prediction horizon extends. Values below 70% require caution.</p>
            </Card>
          </div>
        </>
      )}
    </Page>
  );
};

export default NowcastPage;
