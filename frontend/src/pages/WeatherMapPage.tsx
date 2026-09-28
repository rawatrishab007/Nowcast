import React, { useState, useEffect, useCallback } from 'react';
import Page from '../components/common/Page';
import WeatherMap from '../components/map/WeatherMap';
import type { WeatherMapPoint } from '../types/weather';
import { getMapData } from '../services/weatherApi';

const TIME_STEPS = [
  { label: 'Now',      minutes: 0   },
  { label: '+30 min',  minutes: 30  },
  { label: '+60 min',  minutes: 60  },
  { label: '+120 min', minutes: 120 },
];

const WeatherMapPage: React.FC = () => {
  const [selectedTime, setSelectedTime] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [mapPoints, setMapPoints] = useState<WeatherMapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMap = useCallback(async () => {
    setLoading(true);
    const pts = await getMapData(selectedTime);
    setMapPoints(pts);
    setLoading(false);
  }, [selectedTime]);

  useEffect(() => { loadMap(); }, [loadMap]);

  const handleLocationSelect = (pt: WeatherMapPoint) => {
    setSelectedLocation(pt.id);
  };

  const selectedPt = mapPoints.find(p => p.id === selectedLocation) ?? null;

  const intensityCounts = mapPoints.reduce(
    (acc, p) => { acc[p.intensity] = (acc[p.intensity] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <Page title="Weather Map">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">
            Rainfall intensity and prediction overlay across India.
          </p>
          <p className="text-gray-500 text-xs mt-0.5">Model geographic predictions</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs font-medium">Prediction Time Horizon:</span>
          <div className="flex bg-gray-800 border border-gray-700/80 rounded-lg p-1 gap-1">
            {TIME_STEPS.map(ts => (
              <button
                key={ts.minutes}
                onClick={() => setSelectedTime(ts.minutes)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                  selectedTime === ts.minutes
                    ? 'bg-teal-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {ts.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Monitored Locations', value: mapPoints.length, color: 'text-white' },
          { label: 'Extreme (>40 mm/h)', value: intensityCounts['Extreme'] ?? 0, color: 'text-red-400' },
          { label: 'Heavy (20-40 mm/h)', value: intensityCounts['Heavy'] ?? 0, color: 'text-orange-400' },
          { label: 'Moderate (8-20)', value: intensityCounts['Moderate'] ?? 0, color: 'text-yellow-400' },
          { label: 'Light / None', value: (intensityCounts['Light'] ?? 0) + (intensityCounts['None'] ?? 0), color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-800 border border-gray-700/80 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Main map + side panel */}
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <div className="bg-gray-800 rounded-xl border border-gray-700/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">
                India Geographic Layer ·{' '}
                <span className="text-teal-400">
                  {TIME_STEPS.find(t => t.minutes === selectedTime)?.label}
                </span>
              </h3>
              {loading && (
                <svg className="animate-spin h-4 w-4 text-teal-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>
            <div className="h-[60vh] rounded-lg overflow-hidden border border-gray-700">
              <WeatherMap points={mapPoints} onLocationSelect={handleLocationSelect} />
            </div>
          </div>
        </div>

        {/* Side drawer */}
        <div className="lg:w-72 flex-shrink-0 space-y-4">
          {selectedPt ? (
            <div className="bg-gray-800 border border-gray-700/80 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold">{selectedPt.name}</h3>
                <button onClick={() => setSelectedLocation(null)} className="text-gray-400 hover:text-white text-xs">Clear</button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Condition</span>
                  <span className="text-white font-medium">{selectedPt.condition}</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Rainfall</span>
                  <span className="text-teal-300 font-bold">{selectedPt.rainfall} mm/hr</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Intensity</span>
                  <span className={`font-bold ${
                    selectedPt.intensity === 'Extreme'  ? 'text-red-400' :
                    selectedPt.intensity === 'Heavy'    ? 'text-orange-400' :
                    selectedPt.intensity === 'Moderate' ? 'text-yellow-400' :
                    selectedPt.intensity === 'Light'    ? 'text-green-400' : 'text-teal-400'
                  }`}>{selectedPt.intensity}</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Temperature</span>
                  <span className="text-orange-300">{selectedPt.temperature}°C</span>
                </div>
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Wind</span>
                  <span className="text-cyan-300">{selectedPt.windSpeed} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Alert Level</span>
                  <span className={`font-bold ${
                    selectedPt.alertLevel === 'Critical' ? 'text-red-400' :
                    selectedPt.alertLevel === 'High'     ? 'text-orange-400' :
                    selectedPt.alertLevel === 'Medium'   ? 'text-yellow-400' :
                    selectedPt.alertLevel === 'Low'      ? 'text-blue-400' : 'text-green-400'
                  }`}>{selectedPt.alertLevel}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 border border-gray-700/80 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-sm">Click any map location marker to view detailed nowcast data</p>
            </div>
          )}

          <div className="bg-gray-800 border border-gray-700/80 rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 text-sm">All Locations Overview</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {mapPoints.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => setSelectedLocation(pt.id)}
                  className={`w-full text-left flex items-center justify-between p-2 rounded-lg transition-colors text-xs ${
                    selectedLocation === pt.id
                      ? 'bg-teal-900/40 border border-teal-700'
                      : 'hover:bg-gray-700/60 border border-transparent'
                  }`}
                >
                  <span className="text-gray-300 font-medium">{pt.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold ${
                      pt.rainfall > 40 ? 'text-red-400' :
                      pt.rainfall > 20 ? 'text-orange-400' :
                      pt.rainfall > 8  ? 'text-yellow-400' :
                      pt.rainfall > 0  ? 'text-green-400' : 'text-teal-400'
                    }`}>{pt.rainfall}</span>
                    <span className="text-gray-500">mm/h</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default WeatherMapPage;
