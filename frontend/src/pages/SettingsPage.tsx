import React, { useState } from 'react';
import Page from '../components/common/Page';
import Card from '../components/common/Card';
import { LOCATIONS } from '../constants';

const SettingsPage: React.FC = () => {
  const [defaultLocation, setDefaultLocation] = useState('dehradun');
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [useMockData, setUseMockData] = useState(
    (import.meta.env.VITE_USE_MOCK_DATA ?? 'true') === 'true'
  );
  const [apiBase] = useState(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Page title="Settings">
      <div className="max-w-2xl space-y-6">

        {/* API & Backend Adapter Configuration */}
        <Card title="">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            🔌 WeatherNow AI Backend Adapter
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Backend API Base URL</label>
              <input
                type="text"
                value={apiBase}
                readOnly
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-300 text-sm font-mono cursor-not-allowed"
              />
              <p className="text-gray-400 text-xs mt-1">
                Configured via <code className="bg-gray-700 px-1 rounded">VITE_API_BASE_URL</code> in <code className="bg-gray-700 px-1 rounded">frontend/.env</code>.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg">
              <div>
                <p className="text-white font-medium text-sm">Mock Data Mode</p>
                <p className="text-gray-400 text-xs">Use mock predictions when live backend is offline</p>
              </div>
              <button
                onClick={() => setUseMockData(!useMockData)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  useMockData ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {useMockData ? 'MOCK MODE ON' : 'LIVE API MODE'}
              </button>
            </div>

            <div className="bg-blue-900/20 border border-blue-800/80 rounded-lg px-4 py-3 text-sm text-blue-300 space-y-2">
              <p className="font-semibold text-blue-200">Integration Guide for Backend Developer:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-200 text-xs">
                <li>Create <code className="bg-blue-900/60 px-1 rounded">frontend/.env</code> from <code className="bg-blue-900/60 px-1 rounded">frontend/.env.example</code></li>
                <li>Set <code className="bg-blue-900/60 px-1 rounded">VITE_USE_MOCK_DATA=false</code></li>
                <li>Set <code className="bg-blue-900/60 px-1 rounded">VITE_API_BASE_URL=http://your-ml-server:8000/api</code></li>
                <li>All UI requests in <code className="bg-blue-900/60 px-1 rounded">src/services/weatherApi.ts</code> will automatically connect!</li>
              </ol>
            </div>
          </div>
        </Card>

        {/* Display Preferences */}
        <Card title="">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            🖥️ Display Preferences
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Default Location</label>
              <select
                value={defaultLocation}
                onChange={e => setDefaultLocation(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}, {l.state}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-1.5">
                Auto-Refresh Interval: <span className="text-teal-400 font-bold">{refreshInterval}s</span>
              </label>
              <input
                type="range" min={30} max={300} step={30} value={refreshInterval}
                onChange={e => setRefreshInterval(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>30 seconds</span><span>5 minutes</span>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Unit System</label>
              <div className="flex gap-2">
                {(['metric', 'imperial'] as const).map(u => (
                  <button key={u} onClick={() => setUnits(u)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      units === u ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {u === 'metric' ? '🌡️ Metric (°C, mm/h, km/h)' : '🌡️ Imperial (°F, in/h, mph)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* System Info */}
        <Card title="">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            ℹ️ System Architecture Info
          </h3>
          <div className="space-y-2 text-sm text-gray-300">
            <div className="flex justify-between border-b border-gray-700/60 pb-2">
              <span className="text-gray-400">Application</span>
              <span className="font-semibold text-white">WeatherNow AI</span>
            </div>
            <div className="flex justify-between border-b border-gray-700/60 pb-2">
              <span className="text-gray-400">Version</span>
              <span className="font-mono text-teal-300">1.0.0</span>
            </div>
            <div className="flex justify-between border-b border-gray-700/60 pb-2">
              <span className="text-gray-400">Target ML Model</span>
              <span className="font-semibold text-white">WeatherNow-DGMR Nowcasting Model</span>
            </div>
            <div className="flex justify-between border-b border-gray-700/60 pb-2">
              <span className="text-gray-400">Prediction Horizon</span>
              <span className="text-white">0–120 minutes (15-min intervals)</span>
            </div>
            <div className="flex justify-between border-b border-gray-700/60 pb-2">
              <span className="text-gray-400">Frontend Stack</span>
              <span className="text-white">React 19 · TypeScript · Vite · Leaflet npm</span>
            </div>
          </div>
        </Card>

        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
            saved
              ? 'bg-green-600 text-white shadow-lg'
              : 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg'
          }`}
        >
          {saved ? '✅ Settings Saved Successfully' : 'Save Settings'}
        </button>
      </div>
    </Page>
  );
};

export default SettingsPage;
