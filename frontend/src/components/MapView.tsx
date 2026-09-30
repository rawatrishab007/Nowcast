// ============================================================
// WeatherNow AI — ChatGPT-Style Neutral Dark MapView
// Domain: 8°N–38°N, 68°E–98°E (128x128 AI Grid)
// Features: Multi-Model Hazard Raster, Point-Inspection, Scenario Timeline, Live Coordinates
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SPATIAL_BOUNDS, LOCATIONS } from '../constants';
import type { WeatherLocation, HazardType } from '../types/weather';
import { formatIstTime } from '../utils/timeUtils';

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
          // Light Rain (0.1 - 2.5 mm/hr): Sky Blue
          data[idx] = 56;
          data[idx + 1] = 189;
          data[idx + 2] = 248;
          data[idx + 3] = Math.min(190, Math.round(110 + val * 30));
        } else if (val < 7.5) {
          // Moderate Rain (2.5 - 7.5 mm/hr): Emerald Green
          data[idx] = 34;
          data[idx + 1] = 197;
          data[idx + 2] = 94;
          data[idx + 3] = 210;
        } else if (val < 15.0) {
          // Heavy Rain (7.5 - 15 mm/hr): Yellow
          data[idx] = 234;
          data[idx + 1] = 179;
          data[idx + 2] = 8;
          data[idx + 3] = 230;
        } else if (val < 30.0) {
          // Very Heavy (15 - 30 mm/hr): Orange
          data[idx] = 249;
          data[idx + 1] = 115;
          data[idx + 2] = 22;
          data[idx + 3] = 245;
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
          data[idx + 3] = Math.round(100 + (p - 0.05) * 450);
        } else if (p < 0.50) {
          data[idx] = 245;
          data[idx + 1] = 158;
          data[idx + 2] = 11;
          data[idx + 3] = Math.round(160 + (p - 0.20) * 250);
        } else if (p < 0.75) {
          data[idx] = 239;
          data[idx + 1] = 68;
          data[idx + 2] = 68;
          data[idx + 3] = 240;
        } else {
          data[idx] = 217;
          data[idx + 1] = 70;
          data[idx + 2] = 239;
          data[idx + 3] = 255;
        }
      } else {
        // Severe Weather Risk Score [0.0 - 1.0]
        const s = Math.max(0, Math.min(1, val));
        if (s < 0.10) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        } else if (s < 0.35) {
          // Elevated Risk (0.10 - 0.35): Cyan
          data[idx] = 14;
          data[idx + 1] = 165;
          data[idx + 2] = 233;
          data[idx + 3] = 170;
        } else if (s < 0.60) {
          // High Risk (0.35 - 0.60): Amber
          data[idx] = 245;
          data[idx + 1] = 158;
          data[idx + 2] = 11;
          data[idx + 3] = 210;
        } else if (s < 0.80) {
          // Severe Risk (0.60 - 0.80): Fiery Red
          data[idx] = 239;
          data[idx + 1] = 68;
          data[idx + 2] = 68;
          data[idx + 3] = 240;
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
  const probeMarkerRef = useRef<L.CircleMarker | null>(null);

  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.80);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number; row: number; col: number } | null>(null);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.5, 82.5],
      zoom: 4.8,
      zoomControl: false,
      minZoom: 4,
      maxZoom: 10,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // High-contrast Dark Basemap
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '© Esri, HERE, Garmin',
        maxZoom: 16,
      }
    ).addTo(map);

    // Domain Boundary (8°N–38°N, 68°E–98°E)
    const { minLat, maxLat, minLng, maxLng } = SPATIAL_BOUNDS;
    L.rectangle(
      [[minLat, minLng], [maxLat, maxLng]],
      {
        color: '#3b82f6',
        weight: 1.5,
        fill: false,
        dashArray: '4, 4',
        opacity: 0.85,
      }
    ).addTo(map);

    // Layer Groups
    const stationsGroup = L.layerGroup().addTo(map);
    stationsLayerRef.current = stationsGroup;

    // Track Cursor Coordinates
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        const row = Math.min(127, Math.max(0, Math.round(((maxLat - lat) / (maxLat - minLat)) * 127)));
        const col = Math.min(127, Math.max(0, Math.round(((lng - minLng) / (maxLng - minLng)) * 127)));
        setCursorCoords({ lat, lng, row, col });
      } else {
        setCursorCoords(null);
      }
    });

    // Handle Arbitrary Map Click -> Inspect Custom Coordinate
    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Math.max(minLat, Math.min(maxLat, e.latlng.lat));
      const lng = Math.max(minLng, Math.min(maxLng, e.latlng.lng));
      onLocationSelect({
        id: `custom_${lat.toFixed(3)}_${lng.toFixed(3)}`,
        name: `Resolving (${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E)...`,
        state: 'Custom Map Point',
        lat,
        lng,
        isCustom: true,
        isLoadingName: true,
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [onLocationSelect]);

  // 2. Render Baseline Stations
  useEffect(() => {
    const stationsGroup = stationsLayerRef.current;
    if (!stationsGroup) return;

    stationsGroup.clearLayers();

    LOCATIONS.forEach((loc) => {
      const isSelected = !selectedLocation.isCustom && selectedLocation.id === loc.id;
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: isSelected ? 8 : 5,
        fillColor: isSelected ? '#3b82f6' : '#737373',
        color: isSelected ? '#ffffff' : '#181818',
        weight: isSelected ? 2.5 : 1.5,
        opacity: 1,
        fillOpacity: isSelected ? 1 : 0.85,
      });

      marker.bindTooltip(
        `<div class="font-mono text-xs font-bold text-white">${loc.name}</div><div class="text-[10px] text-[#BDBDBD]">${loc.lat.toFixed(2)}°N, ${loc.lng.toFixed(2)}°E</div>`,
        { direction: 'top', className: 'custom-leaflet-tooltip' }
      );

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onLocationSelect(loc);
      });

      stationsGroup.addLayer(marker);
    });
  }, [selectedLocation, onLocationSelect]);

  // 3. Render Active Probe Marker (for custom map clicks)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (probeMarkerRef.current) {
      probeMarkerRef.current.remove();
      probeMarkerRef.current = null;
    }

    if (selectedLocation.isCustom) {
      const probe = L.circleMarker([selectedLocation.lat, selectedLocation.lng], {
        radius: 9,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 0.95,
      });

      probe.bindTooltip(
        `<div class="font-mono text-xs font-bold text-white">${selectedLocation.name}</div>${
          selectedLocation.state ? `<div class="text-[10px] text-blue-300 font-semibold">${selectedLocation.state}</div>` : ''
        }<div class="text-[9.5px] text-[#BDBDBD] font-mono">${selectedLocation.lat.toFixed(3)}°N, ${selectedLocation.lng.toFixed(3)}°E</div>`,
        { permanent: true, direction: 'top', className: 'custom-leaflet-tooltip' }
      );

      probe.addTo(map);
      probeMarkerRef.current = probe;
    }
  }, [selectedLocation]);

  // 4. Update Raster Overlay Layer
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
    <div className="dark-card p-2 sm:p-3 rounded-2xl flex flex-col h-full min-h-[540px] relative overflow-hidden">
      {/* ── Top Header Bar (Blue Heading) ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#383838] mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 font-heading">
            Live Weather Radar &amp; Nowcast Map
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-[#212121] text-blue-300 font-bold px-2.5 py-0.5 rounded-full border border-[#383838] text-[11px] font-heading">
            +{selectedHorizon}m Horizon
          </span>
          {targetTime && (
            <span className="text-[#BDBDBD] font-mono text-[11px] hidden sm:inline">
              Valid: <strong className="text-white font-semibold">{formatIstTime(targetTime)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Map Canvas Frame */}
      <div className="relative flex-1 w-full min-h-[460px] rounded-xl overflow-hidden border border-[#383838] shadow-inner bg-[#181818]">
        <div ref={mapContainerRef} className="w-full h-full min-h-[460px]" />

        {/* ── Top Floating Timing Pill ── */}
        <div className="absolute top-3 left-3 z-[1000] bg-[#212121]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#383838] shadow-xl flex items-center gap-2 text-xs font-heading">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-white font-bold">+{selectedHorizon}m Forecast</span>
          {targetTime && (
            <span className="text-blue-300 font-mono text-[11px] border-l border-[#383838] pl-2 font-medium">
              {formatIstTime(targetTime)}
            </span>
          )}
        </div>

        {/* ── Top Right Opacity Control ── */}
        <div className="absolute top-3 right-12 z-[1000] bg-[#212121]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#383838] shadow-xl flex items-center gap-2 text-xs font-mono">
          <span className="text-[#BDBDBD] text-[11px] font-sans font-medium">Opacity:</span>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
            className="w-16 h-1.5 bg-[#383838] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-white text-[11px] font-bold w-6 text-right">
            {Math.round(overlayOpacity * 100)}%
          </span>
        </div>

        {/* ── Live Cursor Coordinates Pill ── */}
        {cursorCoords && (
          <div className="absolute top-12 left-3 z-[1000] bg-[#212121]/95 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-[#383838] text-[10px] font-mono text-[#F5F5F5] flex items-center gap-2 shadow-lg">
            <span>{cursorCoords.lat.toFixed(2)}°N, {cursorCoords.lng.toFixed(2)}°E</span>
            <span className="text-blue-400 font-bold">Cell [{cursorCoords.row}, {cursorCoords.col}]</span>
          </div>
        )}

        {/* ── Bottom Map Legend ── */}
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[1000] bg-[#212121]/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-[#383838] shadow-2xl font-sans text-xs space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="font-bold text-white text-[11px] font-heading">
              {selectedHazard === 'rain'
                ? 'Rainfall Rate (mm/hr)'
                : selectedHazard === 'rain_probability'
                ? 'Rain Occurrence Probability (%)'
                : selectedHazard === 'convective_cloud'
                ? 'Cold-Cloud Convection P(B13 < 235 K)'
                : selectedHazard === 'lightning'
                ? 'Lightning Risk Score'
                : selectedHazard === 'thunderstorm'
                ? 'Thunderstorm Risk Score'
                : selectedHazard === 'hail'
                ? 'Hail Risk Score'
                : selectedHazard === 'cloudburst'
                ? 'Cloudburst Risk Score'
                : 'Downburst Risk Score'}
            </span>
            <span className="text-[10px] text-blue-300 font-mono">128×128 AI Grid</span>
          </div>

          {selectedHazard === 'rain' ? (
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-[#BDBDBD]">0.1</span>
              <div className="flex h-3 rounded-md overflow-hidden flex-1 sm:w-64 border border-[#383838]">
                <div className="flex-1 bg-[#38bdf8]" title="0.1 - 2.5 mm/hr (Light)" />
                <div className="flex-1 bg-[#22c55e]" title="2.5 - 7.5 mm/hr (Moderate)" />
                <div className="flex-1 bg-[#eab308]" title="7.5 - 15 mm/hr (Heavy)" />
                <div className="flex-1 bg-[#f97316]" title="15 - 30 mm/hr (Very Heavy)" />
                <div className="flex-1 bg-[#e11d48]" title="> 30 mm/hr (Extreme)" />
              </div>
              <span className="text-white font-bold">&gt;30 mm/h</span>
            </div>
          ) : selectedHazard === 'rain_probability' || selectedHazard === 'convective_cloud' ? (
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-[#BDBDBD]">&lt;15%</span>
              <div className="flex h-3 rounded-md overflow-hidden flex-1 sm:w-64 border border-[#383838]">
                <div className="flex-1 bg-[#38bdf8]" title="<15% Minimal" />
                <div className="flex-1 bg-[#f59e0b]" title="15-45% Moderate" />
                <div className="flex-1 bg-[#ef4444]" title="45-75% High" />
                <div className="flex-1 bg-[#d946ef]" title=">75% Very High" />
              </div>
              <span className="text-white font-bold">&gt;75%</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-[#BDBDBD]">0.10 (Low)</span>
              <div className="flex h-3 rounded-md overflow-hidden flex-1 sm:w-64 border border-[#383838]">
                <div className="flex-1 bg-[#0ea5e9]" title="0.10-0.35 Elevated Risk" />
                <div className="flex-1 bg-[#f59e0b]" title="0.35-0.60 High Risk" />
                <div className="flex-1 bg-[#ef4444]" title="0.60-0.80 Severe Risk" />
                <div className="flex-1 bg-[#a855f7]" title=">0.80 Critical Risk" />
              </div>
              <span className="text-white font-bold">&gt;0.80 (Critical)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
