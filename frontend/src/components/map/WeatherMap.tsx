import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { WeatherMapPoint } from '../../types/weather';

interface WeatherMapProps {
  points: WeatherMapPoint[];
  center?: [number, number];
  zoom?: number;
  onLocationSelect?: (point: WeatherMapPoint) => void;
}

function intensityColor(intensity: WeatherMapPoint['intensity']): string {
  switch (intensity) {
    case 'Extreme':  return '#dc2626'; // red-600
    case 'Heavy':    return '#f97316'; // orange-500
    case 'Moderate': return '#eab308'; // yellow-500
    case 'Light':    return '#22c55e'; // green-500
    case 'None':
    default:         return '#38b2ac'; // teal-500
  }
}

function alertBorderColor(level: WeatherMapPoint['alertLevel']): string {
  switch (level) {
    case 'Critical': return '#dc2626';
    case 'High':     return '#f97316';
    case 'Medium':   return '#eab308';
    case 'Low':      return '#3b82f6';
    default:         return 'transparent';
  }
}

const WeatherMap: React.FC<WeatherMapProps> = ({
  points,
  center = [22.5937, 78.9629],
  zoom = 5,
  onLocationSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [selectedPoint, setSelectedPoint] = useState<WeatherMapPoint | null>(null);
  const [mapTypeId, setMapTypeId] = useState<string>('dark');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Init map using standard Leaflet package
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);
    const lg = L.layerGroup().addTo(map);
    layerGroupRef.current = lg;
    mapInstanceRef.current = map;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tile layer switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) tileLayerRef.current.remove();

    const tileSources: Record<string, { url: string; attr: string }> = {
      dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap contributors © CARTO' },
      satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles © Esri' },
      terrain:   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenTopoMap (CC-BY-SA)' },
      street:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap contributors' },
    };

    const src = tileSources[mapTypeId] ?? tileSources['dark'];
    const layer = L.tileLayer(src.url, { attribution: src.attr, maxZoom: 19 });
    layer.addTo(mapInstanceRef.current);
    tileLayerRef.current = layer;
  }, [mapTypeId]);

  // Update map markers when points change
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    layerGroupRef.current.clearLayers();
    setLastUpdated(new Date());

    points.forEach((pt) => {
      const color = intensityColor(pt.intensity);
      const border = alertBorderColor(pt.alertLevel);
      const radius = 30000 + Math.min(pt.rainfall * 2500, 90000);

      const circle = L.circle([pt.lat, pt.lng], {
        color: border !== 'transparent' ? border : color,
        fillColor: color,
        fillOpacity: 0.45,
        radius,
        weight: border !== 'transparent' ? 2.5 : 1.5,
      });

      circle.bindTooltip(
        `<b>${pt.name}</b><br>🌧 ${pt.rainfall} mm/hr · ${pt.intensity}<br>${pt.condition}`,
        { direction: 'top', offset: [0, -8] }
      );

      circle.on('click', () => {
        setSelectedPoint(pt);
        mapInstanceRef.current?.setView([pt.lat, pt.lng], 8, { animate: true });
        onLocationSelect?.(pt);
      });

      circle.addTo(layerGroupRef.current!);

      if (pt.alertLevel !== 'None') {
        const alertIcon = L.divIcon({
          className: '',
          html: `<div style="font-size:18px;filter:drop-shadow(0 0 4px ${border})">⚠️</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        L.marker([pt.lat, pt.lng], { icon: alertIcon }).addTo(layerGroupRef.current!);
      }
    });
  }, [points, onLocationSelect]);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg border border-gray-700/80 overflow-hidden">
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" style={{ background: '#111827' }} />

      {/* Live indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-gray-900/90 border border-teal-600 px-3 py-1 rounded-full z-[400] flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
        </span>
        <span className="text-teal-400 text-xs font-bold uppercase tracking-wide">Live Nowcast</span>
        <span className="text-gray-400 text-xs border-l border-gray-600 pl-2">
          {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Map style control */}
      <div className="absolute top-3 right-14 z-[400]">
        <select
          value={mapTypeId}
          onChange={(e) => setMapTypeId(e.target.value)}
          className="bg-gray-800 text-white text-xs border border-gray-600 rounded-md px-2 py-1 outline-none cursor-pointer"
        >
          <option value="dark">Dark Tech</option>
          <option value="satellite">Satellite</option>
          <option value="terrain">Terrain</option>
          <option value="street">Street</option>
        </select>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[400] bg-gray-900/90 border border-gray-700 rounded-lg p-3 text-xs space-y-1.5 shadow-xl">
        <p className="text-gray-400 font-semibold uppercase tracking-wide mb-1">Rainfall</p>
        {[
          { label: 'Extreme (>40)', color: '#dc2626' },
          { label: 'Heavy (20–40)', color: '#f97316' },
          { label: 'Moderate (8–20)', color: '#eab308' },
          { label: 'Light (<8)', color: '#22c55e' },
          { label: 'None', color: '#38b2ac' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-gray-300">{label} mm/hr</span>
          </div>
        ))}
      </div>

      {/* Location detail modal */}
      {selectedPoint && (
        <div className="absolute bottom-4 left-4 w-72 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-4 z-[400]">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-bold text-white">{selectedPoint.name}</h3>
              <p className="text-xs text-teal-400 flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                Live Nowcast Active
              </p>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-gray-700">
              <span className="text-gray-400">Condition</span>
              <span className="font-semibold text-white">{selectedPoint.condition}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-700/60 p-2 rounded-lg">
                <p className="text-xs text-gray-400">Rainfall</p>
                <p className="font-mono text-base font-bold text-blue-300">{selectedPoint.rainfall} mm/hr</p>
              </div>
              <div className="bg-gray-700/60 p-2 rounded-lg">
                <p className="text-xs text-gray-400">Temperature</p>
                <p className="font-mono text-base font-bold text-orange-300">{selectedPoint.temperature}°C</p>
              </div>
              <div className="bg-gray-700/60 p-2 rounded-lg">
                <p className="text-xs text-gray-400">Wind</p>
                <p className="font-mono text-base font-bold text-teal-300">{selectedPoint.windSpeed} km/h</p>
              </div>
              <div className="bg-gray-700/60 p-2 rounded-lg">
                <p className="text-xs text-gray-400">Alert Level</p>
                <p className={`font-bold text-sm ${
                  selectedPoint.alertLevel === 'Critical' ? 'text-red-400' :
                  selectedPoint.alertLevel === 'High'     ? 'text-orange-400' :
                  selectedPoint.alertLevel === 'Medium'   ? 'text-yellow-400' :
                  selectedPoint.alertLevel === 'Low'      ? 'text-blue-400' : 'text-green-400'
                }`}>{selectedPoint.alertLevel}</p>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Rainfall Intensity</span>
                <span className="font-semibold" style={{ color: intensityColor(selectedPoint.intensity) }}>
                  {selectedPoint.intensity}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (selectedPoint.rainfall / 50) * 100)}%`,
                    background: intensityColor(selectedPoint.intensity),
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherMap;
