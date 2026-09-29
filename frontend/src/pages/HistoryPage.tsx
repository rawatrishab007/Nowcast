import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import Page from '../components/common/Page';
import Card from '../components/common/Card';
import { LOCATIONS } from '../constants';
import type { WeatherHistoryPoint } from '../types/weather';
import { getWeatherHistory } from '../services/weatherApi';

type TimeRange = 1 | 6 | 24;
type WeatherVar = 'rainfall' | 'temperature' | 'humidity' | 'windSpeed' | 'pressure';

const varConfig: Record<WeatherVar, { label: string; color: string; unit: string; icon: string }> = {
  rainfall:    { label: 'Rainfall',    color: '#14b8a6', unit: 'mm/hr', icon: '🌧️' },
  temperature: { label: 'Temperature', color: '#f97316', unit: '°C',    icon: '🌡️' },
  humidity:    { label: 'Humidity',    color: '#a78bfa', unit: '%',     icon: '💧' },
  windSpeed:   { label: 'Wind Speed',  color: '#60a5fa', unit: 'km/h',  icon: '💨' },
  pressure:    { label: 'Pressure',    color: '#fb7185', unit: 'hPa',   icon: '📊' },
};

const HistoryPage: React.FC = () => {
  const [locationId, setLocationId] = useState('dehradun');
  const [timeRange, setTimeRange] = useState<TimeRange>(24);
  const [activeVar, setActiveVar] = useState<WeatherVar>('rainfall');
  const [data, setData] = useState<WeatherHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const hist = await getWeatherHistory(locationId, timeRange);
    setData(hist);
    setLoading(false);
  }, [locationId, timeRange]);

  useEffect(() => { load(); }, [load]);

  const cfg = varConfig[activeVar];
  const values = data.map(d => d[activeVar] as number);
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '—';
  const max = values.length ? Math.max(...values).toFixed(1) : '—';
  const min = values.length ? Math.min(...values).toFixed(1) : '—';

  return (
    <Page title="Historical Weather">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-gray-800 p-4 rounded-xl border border-gray-700/80 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}, {l.state}</option>)}
          </select>

          <div className="flex bg-gray-900 border border-gray-700 rounded-lg p-1 gap-1">
            {([1, 6, 24] as TimeRange[]).map(h => (
              <button key={h} onClick={() => setTimeRange(h)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                  timeRange === h ? 'bg-teal-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {h === 1 ? 'Last 1h' : h === 6 ? 'Last 6h' : 'Last 24h'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">{data.length} Observations</span>
          <button onClick={load}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-lg px-3 py-1.5 transition-colors"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Variable selector */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(varConfig) as WeatherVar[]).map(v => (
          <button key={v} onClick={() => setActiveVar(v)}
            className={`flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl font-medium transition-all border ${
              activeVar === v
                ? 'border-teal-600 bg-teal-900/40 text-teal-300 font-semibold shadow-md'
                : 'border-gray-700/80 bg-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            <span>{varConfig[v].icon}</span>
            <span>{varConfig[v].label}</span>
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Average', value: avg, unit: cfg.unit },
          { label: 'Maximum', value: max, unit: cfg.unit },
          { label: 'Minimum', value: min, unit: cfg.unit },
        ].map(({ label, value, unit }) => (
          <div key={label} className="bg-gray-800 border border-gray-700/80 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider">{label}</p>
            <p className="text-white text-2xl font-bold mt-1" style={{ color: cfg.color }}>
              {value}<span className="text-gray-400 text-sm font-normal ml-1">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Main chart */}
      <Card title="">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            {cfg.icon} {cfg.label} Historical Trend
            <span className="text-gray-400 text-sm font-normal">
              — {LOCATIONS.find(l => l.id === locationId)?.name}
            </span>
          </h3>
          {loading && (
            <svg className="animate-spin h-4 w-4 text-teal-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cfg.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 11 }}
                interval={timeRange === 24 ? 3 : timeRange === 6 ? 1 : 0} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }}
                label={{ value: cfg.unit, angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val: number) => [`${val} ${cfg.unit}`, cfg.label]} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey={activeVar} name={cfg.label}
                stroke={cfg.color} strokeWidth={2.5} fill="url(#histGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Raw data table */}
      <Card title="">
        <h3 className="text-white font-semibold mb-3">Recorded Weather Data Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-gray-700">
              <tr className="text-gray-400 text-xs uppercase tracking-wider">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3 text-right">Rainfall (mm/h)</th>
                <th className="py-2 px-3 text-right">Temp (°C)</th>
                <th className="py-2 px-3 text-right">Humidity (%)</th>
                <th className="py-2 px-3 text-right">Wind (km/h)</th>
                <th className="py-2 px-3 text-right">Pressure (hPa)</th>
              </tr>
            </thead>
            <tbody>
              {data.slice().reverse().slice(0, 12).map((d, i) => (
                <tr key={i} className="border-b border-gray-700/60 last:border-0 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-teal-300">{d.time}</td>
                  <td className="py-2.5 px-3 text-right text-blue-300">{d.rainfall}</td>
                  <td className="py-2.5 px-3 text-right text-orange-300">{d.temperature}</td>
                  <td className="py-2.5 px-3 text-right text-purple-300">{d.humidity}</td>
                  <td className="py-2.5 px-3 text-right text-cyan-300">{d.windSpeed}</td>
                  <td className="py-2.5 px-3 text-right text-gray-300">{d.pressure}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-gray-400 text-xs mt-2 text-right">Showing last 12 records of {data.length}</p>
        </div>
      </Card>
    </Page>
  );
};

export default HistoryPage;
