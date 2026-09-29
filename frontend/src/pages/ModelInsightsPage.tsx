import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from 'recharts';
import Page from '../components/common/Page';
import Card from '../components/common/Card';
import type { ModelInsights } from '../types/weather';
import { getModelInsights } from '../services/weatherApi';

const ModelInsightsPage: React.FC = () => {
  const [insights, setInsights] = useState<ModelInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const load = async () => {
    const data = await getModelInsights();
    setInsights(data);
    setLastRefreshed(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const confidenceData = [
    { label: 'Now',      confidence: 100 },
    { label: '+15 min',  confidence: 91  },
    { label: '+30 min',  confidence: 88  },
    { label: '+45 min',  confidence: 84  },
    { label: '+60 min',  confidence: 82  },
    { label: '+90 min',  confidence: 74  },
    { label: '+120 min', confidence: 66  },
  ];

  const dataSourceData = [
    { source: 'Radar',          score: insights?.radarDataAvailable ? 95 : 0 },
    { source: 'Satellite',      score: insights?.satelliteDataAvailable ? 88 : 0 },
    { source: 'Ground Station', score: Math.min(100, Math.round((insights?.groundStationCount ?? 0) * 2)) },
    { source: 'NWP Model',      score: 72 },
    { source: 'Historical',     score: 85 },
  ];

  if (loading) {
    return (
      <Page title="AI / Model Insights">
        <div className="flex justify-center py-20">
          <svg className="animate-spin h-10 w-10 text-teal-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </Page>
    );
  }

  if (!insights) return null;

  return (
    <Page title="AI / Model Insights">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Model performance telemetry and data source operational status.
        </p>
        <button onClick={load}
          className="text-xs bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Telemetry
        </button>
      </div>

      {/* Model status banner */}
      <div className={`rounded-xl border p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
        insights.status === 'Active'
          ? 'bg-teal-900/30 border-teal-700/80'
          : 'bg-red-900/30 border-red-700/80'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${insights.status === 'Active' ? 'bg-teal-400 animate-pulse' : 'bg-red-400'}`} />
          <div>
            <p className={`text-lg font-bold ${insights.status === 'Active' ? 'text-teal-300' : 'text-red-300'}`}>
              Model {insights.status}
            </p>
            <p className="text-gray-400 text-sm">{insights.modelName} · {insights.modelVersion}</p>
          </div>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Last Inference</p>
            <p className="text-white font-semibold">
              {new Date(insights.lastInferenceTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Inference Latency</p>
            <p className="text-white font-semibold">{insights.inferenceLatencyMs} ms</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Avg Confidence</p>
            <p className="text-teal-300 font-bold text-lg">{insights.averageConfidence}%</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Refreshed</p>
            <p className="text-white font-semibold">
              {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Prediction Horizon', value: `${insights.predictionHorizonMin} min`, icon: '⏱️', color: 'text-teal-400' },
          { label: 'Observations Used',  value: `${insights.observationsUsed}`,           icon: '📡', color: 'text-blue-400' },
          { label: 'Data Freshness',     value: `${insights.dataFreshnessMin} min ago`,   icon: '🕐', color: 'text-yellow-400' },
          { label: 'Ground Stations',    value: `${insights.groundStationCount}`,          icon: '🏗️', color: 'text-purple-400' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-gray-800 border border-gray-700/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{icon}</span>
              <p className="text-gray-400 text-xs uppercase tracking-wider">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Data sources */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Radar Data',         available: insights.radarDataAvailable,     desc: 'IMD Doppler Radar Network' },
          { label: 'Satellite Data',      available: insights.satelliteDataAvailable, desc: 'INSAT-3DR / 3DS Feeds' },
          { label: 'Ground Stations',    available: insights.groundStationCount > 0,  desc: `${insights.groundStationCount} AWS Active` },
        ].map(({ label, available, desc }) => (
          <div key={label} className={`rounded-xl border p-4 flex items-center gap-4 ${
            available ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'
          }`}>
            <span className={`text-3xl ${available ? '' : 'grayscale opacity-50'}`}>
              {available ? '✅' : '❌'}
            </span>
            <div>
              <p className={`font-semibold ${available ? 'text-green-300' : 'text-red-300'}`}>{label}</p>
              <p className="text-gray-400 text-xs">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="">
          <h3 className="text-white font-semibold mb-4">Confidence by Prediction Horizon</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: number) => [`${val}%`, 'Confidence']} />
                <Bar dataKey="confidence" name="Confidence (%)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="">
          <h3 className="text-white font-semibold mb-4">Input Source Quality Index</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={dataSourceData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="source" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Radar name="Quality Score" dataKey="score" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.3} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Full telemetry table */}
      <Card title="">
        <h3 className="text-white font-semibold mb-3">Model Telemetry Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Model Name',            value: insights.modelName },
            { label: 'Model Version',          value: insights.modelVersion },
            { label: 'Status',                 value: insights.status,            valueClass: insights.status === 'Active' ? 'text-teal-400 font-bold' : 'text-red-400' },
            { label: 'Prediction Horizon',     value: `0–${insights.predictionHorizonMin} minutes` },
            { label: 'Last Inference',         value: new Date(insights.lastInferenceTime).toLocaleString('en-IN') },
            { label: 'Inference Latency',      value: `${insights.inferenceLatencyMs} ms` },
            { label: 'Average Confidence',     value: `${insights.averageConfidence}%` },
            { label: 'Observations Used',      value: `${insights.observationsUsed}` },
            { label: 'Input Data Timestamp',   value: new Date(insights.inputDataTimestamp).toLocaleString('en-IN') },
            { label: 'Data Freshness',         value: `${insights.dataFreshnessMin} minutes ago` },
            { label: 'Radar Data',             value: insights.radarDataAvailable ? 'Available ✅' : 'Unavailable ❌' },
            { label: 'Satellite Data',         value: insights.satelliteDataAvailable ? 'Available ✅' : 'Unavailable ❌' },
            { label: 'Active Ground Stations', value: `${insights.groundStationCount}` },
          ].map(({ label, value, valueClass }) => (
            <div key={label} className="flex justify-between items-center border-b border-gray-700/60 py-2 last:border-0">
              <span className="text-gray-400">{label}</span>
              <span className={`font-medium ${valueClass ?? 'text-white'}`}>{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
};

export default ModelInsightsPage;
