import React, { useState, useEffect, useCallback } from 'react';
import Page from '../components/common/Page';
import Card from '../components/common/Card';
import WeatherMap from '../components/map/WeatherMap';
import PredictionChart from '../components/charts/PredictionChart';
import { LOCATIONS, CONDITION_ICONS } from '../constants';
import type { CurrentWeather, NowcastPrediction, WeatherAlert, ModelInsights, WeatherMapPoint } from '../types/weather';
import {
  getCurrentWeather, getNowcast, getAlerts, getModelInsights, getMapData,
} from '../services/weatherApi';

// ---------- Metric Summary Card ----------
interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  color: string;
  sub?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit, icon, color, sub }) => (
  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/80 flex items-start gap-4 shadow-md">
    <div className={`p-3 rounded-lg ${color} flex-shrink-0`}>
      <span className="text-2xl">{icon}</span>
    </div>
    <div className="min-w-0">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-white text-2xl font-bold leading-none mt-1">
        {value}<span className="text-gray-400 text-sm font-normal ml-1">{unit}</span>
      </p>
      {sub && <p className="text-gray-400 text-xs mt-1 truncate">{sub}</p>}
    </div>
  </div>
);

// ---------- Nowcast Step Timeline Card ----------
interface NowcastStepCardProps {
  label: string;
  rainfall: number;
  condition: string;
  confidence: number;
  isNow?: boolean;
}

const NowcastStepCard: React.FC<NowcastStepCardProps> = ({ label, rainfall, condition, confidence, isNow }) => {
  const intensity =
    rainfall > 40 ? { text: 'Extreme', color: 'text-red-400', bg: 'bg-red-900/30 border-red-800' } :
    rainfall > 20 ? { text: 'Heavy',   color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-800' } :
    rainfall > 8  ? { text: 'Moderate',color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-800' } :
    rainfall > 0  ? { text: 'Light',   color: 'text-green-400', bg: 'bg-green-900/30 border-green-800' } :
                    { text: 'None',    color: 'text-teal-400', bg: 'bg-teal-900/30 border-teal-800' };

  return (
    <div className={`flex-1 min-w-[100px] rounded-xl p-3 border transition-all duration-200 ${
      isNow
        ? 'bg-teal-900/40 border-teal-500 shadow-lg shadow-teal-900/30'
        : `${intensity.bg}`
    }`}>
      <div className="flex justify-between items-start mb-1.5">
        <span className={`text-xs font-bold uppercase tracking-wider ${isNow ? 'text-teal-300' : 'text-gray-400'}`}>
          {label}
        </span>
        <span className="text-lg">{CONDITION_ICONS[condition] ?? '🌡️'}</span>
      </div>
      <p className={`text-xl font-bold ${intensity.color}`}>
        {rainfall.toFixed(1)}<span className="text-xs font-normal ml-0.5 text-gray-400">mm/h</span>
      </p>
      <p className="text-gray-300 text-xs mt-0.5 truncate">{condition}</p>
      {!isNow && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
            <span>Conf.</span><span>{confidence}%</span>
          </div>
          <div className="w-full bg-gray-700/80 rounded-full h-1">
            <div
              className="h-1 rounded-full bg-teal-400 transition-all"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Alert Row ----------
const AlertRow: React.FC<{ alert: WeatherAlert }> = ({ alert }) => {
  const severityColor =
    alert.severity === 'Critical' ? 'bg-red-900/60 border-red-700 text-red-200' :
    alert.severity === 'High'     ? 'bg-orange-900/60 border-orange-700 text-orange-200' :
    alert.severity === 'Medium'   ? 'bg-yellow-900/60 border-yellow-700 text-yellow-200' :
                                    'bg-blue-900/60 border-blue-700 text-blue-200';
  return (
    <div className={`rounded-lg border px-3 py-2.5 flex items-start gap-3 ${severityColor}`}>
      <span className="text-xl flex-shrink-0 mt-0.5">{alert.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{alert.title}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
            alert.severity === 'Critical' ? 'bg-red-700 text-white' :
            alert.severity === 'High'     ? 'bg-orange-700 text-white' :
            alert.severity === 'Medium'   ? 'bg-yellow-700 text-white' :
                                            'bg-blue-700 text-white'
          }`}>{alert.severity}</span>
        </div>
        <p className="text-xs opacity-90 mt-0.5 truncate">{alert.locationName} · in {alert.predictionHorizon}</p>
      </div>
    </div>
  );
};

// ---------- Main WeatherNow AI Dashboard ----------
const Dashboard: React.FC = () => {
  const [locationId, setLocationId] = useState('dehradun');
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [nowcast, setNowcast] = useState<NowcastPrediction | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [modelInsights, setModelInsights] = useState<ModelInsights | null>(null);
  const [mapPoints, setMapPoints] = useState<WeatherMapPoint[]>([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [cur, nc, al, mi, mp] = await Promise.all([
      getCurrentWeather(locationId),
      getNowcast(locationId),
      getAlerts(),
      getModelInsights(),
      getMapData(0),
    ]);
    setCurrent(cur);
    setNowcast(nc);
    setAlerts(al.filter(a => a.status === 'Active').slice(0, 4));
    setModelInsights(mi);
    setMapPoints(mp);
    setLastUpdated(new Date());
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  useEffect(() => {
    const id = setInterval(loadData, 60000);
    return () => clearInterval(id);
  }, [loadData]);

  const activeAlerts = alerts.filter(a => a.status === 'Active');
  const location = LOCATIONS.find(l => l.id === locationId);

  if (loading) {
    return (
      <Page title="Weather Nowcasting Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-10 w-10 text-teal-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-gray-400 text-sm">Loading WeatherNow AI data feed...</span>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page title="Weather Nowcasting Dashboard">

      {/* ── Location Selector Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-800 rounded-xl px-5 py-4 border border-gray-700/80 shadow-md">
        <div>
          <div className="flex items-center gap-3">
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3.5 py-1.5 text-white text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {LOCATIONS.map(l => (
                <option key={l.id} value={l.id}>{l.name}, {l.state}</option>
              ))}
            </select>
            <span className="text-gray-600 hidden sm:block">·</span>
            <span className="text-gray-400 text-sm hidden sm:block">
              {location?.elevation}m Elevation
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1">
            Last data update: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {modelInsights && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
              modelInsights.status === 'Active'
                ? 'bg-teal-900/50 border border-teal-700 text-teal-300'
                : 'bg-red-900/50 border border-red-700 text-red-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${modelInsights.status === 'Active' ? 'bg-teal-400 animate-pulse' : 'bg-red-400'}`} />
              Model {modelInsights.status}
            </div>
          )}
          {activeAlerts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-900/50 border border-red-700 text-red-300 px-3 py-1.5 rounded-full text-xs font-semibold">
              ⚠️ {activeAlerts.length} Alert{activeAlerts.length > 1 ? 's' : ''}
            </div>
          )}
          <button
            onClick={loadData}
            className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Demo Notice Banner ── */}
      <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-800/80 rounded-lg px-4 py-2 text-blue-300 text-xs">
        <span>ℹ️</span>
        <span><strong>DEMO MODE ACTIVE</strong> — Frontend is using mock predictions. Set <code className="bg-blue-900/60 px-1 rounded">VITE_USE_MOCK_DATA=false</code> to connect live backend API.</span>
      </div>

      {/* ── Current Conditions Summary ── */}
      {current && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Temperature"  value={`${current.temperature}`} unit="°C"   icon="🌡️" color="bg-orange-900/40" sub={`Feels ${current.feelsLike}°C`} />
          <MetricCard label="Humidity"     value={`${current.humidity}`}    unit="%"    icon="💧" color="bg-blue-900/40"   sub={`Dew pt ${current.dewPoint}°C`} />
          <MetricCard label="Rainfall"     value={`${current.rainfall}`}    unit="mm/h" icon="🌧️" color="bg-indigo-900/40" sub="Current observation" />
          <MetricCard label="Wind Speed"   value={`${current.windSpeed}`}   unit="km/h" icon="💨" color="bg-cyan-900/40"  sub={`Direction: ${current.windDirection}`} />
          <MetricCard label="Visibility"   value={`${current.visibility}`}  unit="km"   icon="👁️" color="bg-purple-900/40" sub="Horizontal" />
          <MetricCard label="Pressure"     value={`${current.pressure}`}    unit="hPa"  icon="📊" color="bg-teal-900/40"  sub={current.condition} />
        </div>
      )}

      {/* ── NOWCAST PREDICTIONS SECTION ── */}
      {nowcast && (
        <div className="bg-gray-800 rounded-xl border border-gray-700/80 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-lg font-bold flex items-center gap-2">
                🤖 AI Nowcast Predictions
                <span className="text-xs bg-teal-900/50 border border-teal-700 text-teal-300 px-2 py-0.5 rounded-full font-normal">
                  0–120 min horizon
                </span>
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Model: WeatherNow-DGMR · Run: {new Date(nowcast.modelRunTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span className="text-gray-400 text-xs hidden sm:block">Confidence decays over 120-min horizon</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {nowcast.predictions.map(step => (
              <NowcastStepCard
                key={step.minutesAhead}
                label={step.label}
                rainfall={step.rainfall}
                condition={step.condition}
                confidence={step.confidence}
                isNow={step.minutesAhead === 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Observed vs Predicted Chart + Weather Map ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Separated Observed vs Predicted Chart */}
        <div className="lg:col-span-3">
          <Card title="">
            {nowcast && (
              <PredictionChart
                observations={nowcast.observations}
                predictions={nowcast.predictions}
              />
            )}
          </Card>
        </div>

        {/* Geographic Map */}
        <div className="lg:col-span-2">
          <Card title="">
            <h3 className="text-white font-semibold text-base mb-3">Weather Map (Now)</h3>
            <div className="h-[300px] rounded-lg overflow-hidden border border-gray-700">
              <WeatherMap points={mapPoints} />
            </div>
          </Card>
        </div>
      </div>

      {/* ── Active Alerts + Model Insights Telemetry ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card title="">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                ⚠️ Early Warning Alerts
                {activeAlerts.length > 0 && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {activeAlerts.length}
                  </span>
                )}
              </h3>
              <span className="text-gray-400 text-xs">DEMO DATA — Model generated alert signals</span>
            </div>
            <div className="space-y-2">
              {activeAlerts.length > 0 ? activeAlerts.map(a => (
                <AlertRow key={a.id} alert={a} />
              )) : (
                <p className="text-gray-400 text-sm py-4 text-center">No active weather warnings</p>
              )}
            </div>
          </Card>
        </div>

        {modelInsights && (
          <Card title="">
            <h3 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
              🤖 Model Telemetry
            </h3>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Model', value: `${modelInsights.modelName} ${modelInsights.modelVersion}` },
                { label: 'Status', value: modelInsights.status, valueClass: 'text-teal-400 font-bold' },
                { label: 'Inference Latency', value: `${modelInsights.inferenceLatencyMs} ms` },
                { label: 'Avg Confidence', value: `${modelInsights.averageConfidence}%` },
                { label: 'Observations Used', value: `${modelInsights.observationsUsed}` },
                { label: 'Data Freshness', value: `${modelInsights.dataFreshnessMin} min ago` },
                { label: 'Radar Feed', value: modelInsights.radarDataAvailable ? '✅ Active' : '❌ Offline' },
                { label: 'Satellite Feed', value: modelInsights.satelliteDataAvailable ? '✅ Active' : '❌ Offline' },
              ].map(({ label, value, valueClass }) => (
                <div key={label} className="flex justify-between items-center border-b border-gray-700/60 pb-2 last:border-0 last:pb-0">
                  <span className="text-gray-400">{label}</span>
                  <span className={`font-medium text-right ${valueClass ?? 'text-white'}`}>{value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

    </Page>
  );
};

export default Dashboard;