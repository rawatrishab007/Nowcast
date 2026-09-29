// ============================================================
// WeatherNow AI — Leaflet MapView & Multi-Model Raster Layer
// Domain: 8°N–38°N, 68°E–98°E (128x128 Grid)
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SPATIAL_BOUNDS, LOCATIONS } from '../constants';
import type { WeatherLocation, HazardType } from '../types/weather';

interface MapViewProps {
  gridMap?: number[][]; // 128x128 grid
  selectedHazard: HazardType;
  selectedHorizon: number;
  onHorizonSelect: (horizon: number) => void;
  selectedLocation: WeatherLocation;
  onLocationSelect: (location: WeatherLocation) => void;
  targetTime?: string;
}

function generateRasterDataUrl(grid: number[][], hazard: HazardType): string {
  const height = grid.length;
  const width = grid[0]?.length || 128;
  if (height === 0 || width === 0) return '';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = (r * width + c) * 4;
      const val = grid[r]?.[c] ?? 0;

      if (hazard === 'rain') {
        // Rainfall Rate in mm/hr
        if (val < 0.1) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        } else if (val < 2.5) {
          // Light Rain (0.1 - 2.5 mm/hr): Cyan / Blue
          data[idx] = 56;
          data[idx + 1] = 189;
          data[idx + 2] = 248;
          data[idx + 3] = Math.min(180, Math.round(100 + val * 30));
        } else if (val < 7.5) {
          // Moderate Rain (2.5 - 7.5 mm/hr): Green
          data[idx] = 34;
          data[idx + 1] = 197;
          data[idx + 2] = 94;
          data[idx + 3] = 200;
        } else if (val < 15.0) {
          // Heavy Rain (7.5 - 15 mm/hr): Yellow
          data[idx] = 234;
          data[idx + 1] = 179;
          data[idx + 2] = 8;
          data[idx + 3] = 225;
        } else if (val < 30.0) {
          // Very Heavy (15 - 30 mm/hr): Orange
          data[idx] = 249;
          data[idx + 1] = 115;
          data[idx + 2] = 22;
          data[idx + 3] = 240;
        } else {
          // Extreme (> 30 mm/hr): Crimson / Violet
          data[idx] = 225;
          data[idx + 1] = 29;
          data[idx + 2] = 72;
          data[idx + 3] = 255;
        }
      } else if (hazard === 'rain_probability' || hazard === 'convective_cloud') {
        // Continuous Probability [0.0 - 1.0]
        const p = Math.max(0, Math.min(1, val));
        if (p < 0.05) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        } else if (p < 0.20) {
          data[idx] = 56;
          data[idx + 1] = 189;
          data[idx + 2] = 248;
          data[idx + 3] = Math.round(90 + (p - 0.05) * 450);
        } else if (p < 0.50) {
          data[idx] = 245;
          data[idx + 1] = 158;
          data[idx + 2] = 11;
          data[idx + 3] = Math.round(150 + (p - 0.20) * 250);
        } else if (p < 0.75) {
          data[idx] = 239;
          data[idx + 1] = 68;
          data[idx + 2] = 68;
          data[idx + 3] = 235;
        } else {
          data[idx] = 217;
          data[idx + 1] = 70;
          data[idx + 2] = 239;
          data[idx + 3] = 250;
        }
      } else {
        // Physics-informed Severe Weather Risk Score [0.0 - 1.0]
        const s = Math.max(0, Math.min(1, val));
        if (s < 0.10) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        } else if (s < 0.35) {
          // Elevated Risk (0.10 - 0.35): Teal
          data[idx] = 20;
          data[idx + 1] = 184;
          data[idx + 2] = 166;
          data[idx + 3] = 160;
        } else if (s < 0.60) {
          // High Risk (0.35 - 0.60): Amber
          data[idx] = 245;
          data[idx + 1] = 158;
          data[idx + 2] = 11;
          data[idx + 3] = 200;
        } else if (s < 0.80) {
          // Severe Risk (0.60 - 0.80): Fiery Red
          data[idx] = 239;
          data[idx + 1] = 68;
          data[idx + 2] = 68;
          data[idx + 3] = 235;
        } else {
          // Critical Risk (> 0.80): Purple
          data[idx] = 168;
          data[idx + 1] = 85;
          data[idx + 2] = 247;
          data[idx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL();
}

export const MapView: React.FC<MapViewProps> = ({
  gridMap,
  selectedHazard,
  selectedHorizon,
  selectedLocation,
  onLocationSelect,
  targetTime,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const rasterLayerRef = useRef<L.ImageOverlay | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);
  const customProbeMarkerRef = useRef<L.CircleMarker | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.80);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.0, 83.0],
      zoom: 4.6,
      zoomControl: false,
      minZoom: 4,
      maxZoom: 9,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // High-contrast dark basemap
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '© Esri, HERE, Garmin',
        maxZoom: 16,
      }
    ).addTo(map);

    // Domain Boundary Rectangle (8°N–38°N, 68°E–98°E)
    const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;
    L.rectangle(
      [[minLat, minLng], [maxLat, maxLng]],
      {
        color: '#14b8a6',
        weight: 1.5,
        fill: false,
        dashArray: '4, 4',
        opacity: 0.8,
      }
    ).addTo(map);

    // Stations layer group
    const stationsGroup = L.layerGroup().addTo(map);
    stationsLayerRef.current = stationsGroup;

    // Handle arbitrary map clicks -> inspect custom coordinates
    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Math.max(minLat, Math.min(maxLat, e.latlng.lat));
      const lng = Math.max(minLng, Math.min(maxLng, e.latlng.lng));
      onLocationSelect({
        id: `custom_${lat.toFixed(2)}_${lng.toFixed(2)}`,
        name: `Probe (${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E)`,
        state: 'Custom Probe',
        lat,
        lng,
        isCustom: true,
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [onLocationSelect]);

  // Update Station Markers & Custom Probe
  useEffect(() => {
    const map = mapInstanceRef.current;
    const stationsGroup = stationsLayerRef.current;
    if (!map || !stationsGroup) return;

    stationsGroup.clearLayers();

    LOCATIONS.forEach((loc) => {
      const isSelected = !selectedLocation.isCustom && selectedLocation.id === loc.id;
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: isSelected ? 8 : 5,
        fillColor: isSelected ? '#38bdf8' : '#64748b',
        color: isSelected ? '#ffffff' : '#1e293b',
        weight: isSelected ? 2.5 : 1.5,
        opacity: 1,
        fillOpacity: isSelected ? 1 : 0.8,
      });

      marker.bindTooltip(
        `<div class="font-mono text-xs font-bold text-gray-100">${loc.name}</div><div class="text-[10px] text-gray-400">${loc.lat.toFixed(2)}°N, ${loc.lng.toFixed(2)}°E</div>`,
        { permanent: isSelected, direction: 'top', className: 'custom-leaflet-tooltip' }
      );

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onLocationSelect(loc);
      });

      stationsGroup.addLayer(marker);
    });

    // Custom Probe Marker
    if (selectedLocation.isCustom) {
      if (customProbeMarkerRef.current) {
        customProbeMarkerRef.current.remove();
      }
      const probe = L.circleMarker([selectedLocation.lat, selectedLocation.lng], {
        radius: 8,
        fillColor: '#ec4899',
        color: '#ffffff',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 1,
      });
      probe.bindTooltip(
        `<div class="font-mono text-xs font-bold text-pink-300">Custom Probe</div><div class="text-[10px] text-gray-300">${selectedLocation.lat.toFixed(3)}°N, ${selectedLocation.lng.toFixed(3)}°E</div>`,
        { permanent: true, direction: 'top', className: 'custom-leaflet-tooltip' }
      );
      probe.addTo(map);
      customProbeMarkerRef.current = probe;
    } else if (customProbeMarkerRef.current) {
      customProbeMarkerRef.current.remove();
      customProbeMarkerRef.current = null;
    }
  }, [selectedLocation, onLocationSelect]);

  // Update Raster Overlay Layer on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (rasterLayerRef.current) {
      rasterLayerRef.current.remove();
      rasterLayerRef.current = null;
    }

    if (!gridMap || gridMap.length !== 128) return;

    const dataUrl = generateRasterDataUrl(gridMap, selectedHazard);
    if (!dataUrl) return;

    const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;
    const bounds: L.LatLngBoundsExpression = [[minLat, minLng], [maxLat, maxLng]];

    const overlay = L.imageOverlay(dataUrl, bounds, {
      opacity: overlayOpacity,
      interactive: false,
    }).addTo(map);

    rasterLayerRef.current = overlay;
  }, [gridMap, selectedHazard, overlayOpacity]);

  return (
    <div className="relative w-full h-full min-h-[500px] flex-1 rounded-xl overflow-hidden border border-gray-700/80 shadow-2xl bg-gray-900">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />

      {/* Top Banner: Active Horizon & Timestamp */}
      <div className="absolute top-3 left-3 z-[1000] bg-gray-950/85 backdrop-blur-md px-3.5 py-2 rounded-lg border border-gray-700/80 shadow-xl font-mono flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-white font-bold text-xs tracking-wider">
            +{selectedHorizon}m Forecast
          </span>
        </div>
        {targetTime && (
          <span className="text-[11px] text-gray-400 border-l border-gray-700 pl-3">
            Valid: <span className="text-teal-300 font-semibold">{new Date(targetTime).toISOString().replace('T', ' ').slice(11, 16)} UTC</span>
          </span>
        )}
      </div>

      {/* Top Right: Opacity Control */}
      <div className="absolute top-3 right-12 z-[1000] bg-gray-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-700/80 shadow-xl flex items-center gap-2 font-mono text-xs">
        <span className="text-gray-400 text-[10px]">Opacity:</span>
        <input
          type="range"
          min="0.2"
          max="1.0"
          step="0.05"
          value={overlayOpacity}
          onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
          className="w-16 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
        />
        <span className="text-gray-300 text-[10px] w-6 text-right">
          {Math.round(overlayOpacity * 100)}%
        </span>
      </div>

      {/* Bottom Floating Legend */}
      <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[1000] bg-gray-950/90 backdrop-blur-md px-3.5 py-2.5 rounded-lg border border-gray-700/80 shadow-2xl font-mono text-[11px] space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="font-bold text-gray-200">
            {selectedHazard === 'rain'
              ? 'Rainfall Intensity (mm/hr)'
              : selectedHazard === 'convective_cloud'
              ? 'Convective Cloud P(B13 < 235 K)'
              : selectedHazard === 'rain_probability'
              ? 'Rain Occurrence Probability'
              : `${selectedHazard.replace('_', ' ').toUpperCase()} Risk Score`}
          </span>
          <span className="text-[9px] text-gray-400">128×128 AI Grid</span>
        </div>

        {selectedHazard === 'rain' ? (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-gray-500">0.1</span>
            <div className="flex h-3 rounded overflow-hidden flex-1 sm:w-64 border border-gray-700">
              <div className="flex-1 bg-[#38bdf8]" title="0.1 - 2.5 mm/hr (Light)" />
              <div className="flex-1 bg-[#22c55e]" title="2.5 - 7.5 mm/hr (Moderate)" />
              <div className="flex-1 bg-[#eab308]" title="7.5 - 15 mm/hr (Heavy)" />
              <div className="flex-1 bg-[#f97316]" title="15 - 30 mm/hr (Very Heavy)" />
              <div className="flex-1 bg-[#e11d48]" title="> 30 mm/hr (Extreme)" />
            </div>
            <span className="text-gray-400 font-bold">&gt;30 mm/hr</span>
          </div>
        ) : selectedHazard === 'rain_probability' || selectedHazard === 'convective_cloud' ? (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-gray-500">&lt;15%</span>
            <div className="flex h-3 rounded overflow-hidden flex-1 sm:w-64 border border-gray-700">
              <div className="flex-1 bg-[#38bdf8]" title="<15% Minimal" />
              <div className="flex-1 bg-[#f59e0b]" title="15-45% Moderate" />
              <div className="flex-1 bg-[#ef4444]" title="45-75% High" />
              <div className="flex-1 bg-[#d946ef]" title=">75% Very High" />
            </div>
            <span className="text-gray-400 font-bold">&gt;75%</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-gray-500">Low</span>
            <div className="flex h-3 rounded overflow-hidden flex-1 sm:w-64 border border-gray-700">
              <div className="flex-1 bg-[#14b8a6]" title="0.10-0.35 Elevated" />
              <div className="flex-1 bg-[#f59e0b]" title="0.35-0.60 High" />
              <div className="flex-1 bg-[#ef4444]" title="0.60-0.80 Severe" />
              <div className="flex-1 bg-[#a855f7]" title=">0.80 Critical" />
            </div>
            <span className="text-gray-400 font-bold">Critical</span>
          </div>
        )}
      </div>
    </div>
  );
};
