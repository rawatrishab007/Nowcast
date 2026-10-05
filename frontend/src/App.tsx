// ============================================================
// WeatherNow AI — Strict Black + Blue + White High-Contrast Dashboard
// Multi-Model Neural Nowcasting (V4, V3) & Severe Hazard Assessment (V1)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import type {
  UnifiedNowcastResponse,
  HealthResponse,
  PipelineHealthResponse,
  WeatherLocation,
  HazardType,
} from './types/weather';
import { LOCATIONS } from './constants';
import { getUnifiedNowcast, getHealth, getPipelineHealth } from './services/api';
import { Header } from './components/Header';
import { SummaryMetricCards } from './components/SummaryMetricCards';
import { MapView } from './components/MapView';
import { PredictionControls } from './components/PredictionControls';
import { ScenarioReplayControls } from './components/ScenarioReplayControls';
import { LocationInspector } from './components/LocationInspector';
import { LocationRiskCard } from './components/LocationRiskCard';
import { AlertEngineCard } from './components/AlertEngineCard';
import { ForecastTrendChart } from './components/ForecastTrendChart';
import { OperationalIntegrationCard } from './components/OperationalIntegrationCard';
import { DataHealthMonitor } from './components/DataHealthMonitor';
import { SituationReportModal } from './components/SituationReportModal';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';

import { reverseGeocode } from './utils/geocoding';

export const App: React.FC = () => {
  const [prediction, setPrediction] = useState<UnifiedNowcastResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealthResponse | null>(null);

  const [selectedHazard, setSelectedHazard] = useState<HazardType>('rain');
  const [selectedHorizon, setSelectedHorizon] = useState<number>(30);
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation>(LOCATIONS[0]);

  // Geocoding cancellation ref
  const geocodeAbortRef = React.useRef<AbortController | null>(null);

  // Modals & operational states
  const [isSituationReportOpen, setIsSituationReportOpen] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/reports');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  // Sync browser back/forward navigation with modal/tab state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setIsSituationReportOpen(window.location.pathname.startsWith('/reports'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavTabChange = useCallback((tab: string) => {
    if (tab === 'Home') {
      setIsSituationReportOpen(false);
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
      }
    } else if (tab === 'Reports') {
      setIsSituationReportOpen(true);
      if (typeof window !== 'undefined' && window.location.pathname !== '/reports') {
        window.history.pushState(null, '', '/reports');
      }
    }
  }, []);

  // Handle Station / Custom Probe Location Select with Reverse Geocoding
  const handleLocationSelect = useCallback(async (loc: WeatherLocation) => {
    // 1. If selecting a predefined station
    if (!loc.isCustom) {
      if (geocodeAbortRef.current) {
        geocodeAbortRef.current.abort();
        geocodeAbortRef.current = null;
      }
      setSelectedLocation(loc);
      return;
    }

    // 2. If selecting a custom map point
    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort();
    }
    const controller = new AbortController();
    geocodeAbortRef.current = controller;

    // Immediately set coordinates & grid cell state with a clean resolving placeholder
    setSelectedLocation({
      ...loc,
      name: `Resolving (${loc.lat.toFixed(2)}°N, ${loc.lng.toFixed(2)}°E)...`,
      state: 'Resolving locality...',
      isLoadingName: true,
    });

    try {
      const geo = await reverseGeocode(loc.lat, loc.lng, controller.signal);
      if (!controller.signal.aborted) {
        setSelectedLocation({
          ...loc,
          name: geo.name,
          state: geo.state,
          isLoadingName: false,
        });
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setSelectedLocation({
          ...loc,
          name: 'Unnamed Location',
          state: 'Custom Map Point',
          isLoadingName: false,
        });
      }
    }
  }, []);

  // Fetch operational multi-model nowcast data
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    try {
      const [pred, hlt, pipeHlt] = await Promise.all([
        getUnifiedNowcast(forceRefresh),
        getHealth(),
        getPipelineHealth(),
      ]);
      setPrediction(pred);
      setHealth(hlt);
      setPipelineHealth(pipeHlt);
      setError(null);
      setErrorCode(undefined);
    } catch (err: any) {
      console.error('[WeatherNow AI] Operational Data Ingestion Error:', err);
      setError(err?.message || 'Unable to fetch operational nowcasting predictions.');
      setErrorCode(err?.errorCode || 'PIPELINE_ERROR');
      try {
        const [hlt, pipeHlt] = await Promise.all([getHealth(), getPipelineHealth()]);
        setHealth(hlt);
        setPipelineHealth(pipeHlt);
      } catch {}
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
    // Auto-refresh cadence every 60 seconds
    const interval = setInterval(() => loadData(false), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const activeHorizonData = prediction?.horizons?.[String(selectedHorizon)];
  const activeHazardLayer = activeHorizonData ? (activeHorizonData[selectedHazard] as any) : undefined;
  const activeGridMap = activeHazardLayer?.map;
  const activeTargetTime = activeHorizonData?.target_time;
  const targetTimes = prediction?.provenance?.target_times;

  return (
    <div className="flex flex-col min-h-screen bg-[#181818] text-[#F5F5F5] font-sans select-none antialiased">
      {/* ── 1. Top Operational Navigation Bar ── */}
      <Header
        prediction={prediction}
        health={health}
        isLoading={isLoading}
        onRefresh={() => loadData(true)}
        selectedLocation={selectedLocation}
        onOpenSituationReport={() => handleNavTabChange('Reports')}
        activeNavTab={isSituationReportOpen ? 'Reports' : 'Home'}
        onNavTabChange={handleNavTabChange}
      />

      {/* ── 2. Primary Operational Dashboard Workspace ── */}
      <main className="flex-1 p-3.5 sm:p-6 max-w-[1680px] w-full mx-auto space-y-5">
        {/* Ingestion Warning / Error Banner */}
        {error && (
          <ErrorState
            title="Operational Data Pipeline Notice"
            message={error}
            errorCode={errorCode}
            onRetry={() => loadData(true)}
          />
        )}

        {/* Initial Loading Overlay */}
        {isLoading && !prediction && (
          <LoadingState
            message="Ingesting Live Himawari-9 AHI Satellite & NOAA GFS Atmospheric Fields..."
            subtext="Executing multi-model inference across V4 Rainfall Nowcast, V3 Convective Cloud, and V1 Severe Weather Assessment..."
          />
        )}

        {/* ── Top Summary Metric 4-Card Overview ── */}
        <SummaryMetricCards
          prediction={prediction}
          health={health}
          pipelineHealth={pipelineHealth}
          selectedLocation={selectedLocation}
          selectedHazard={selectedHazard}
          selectedHorizon={selectedHorizon}
        />

        {/* ── Top Hazard Layer Selector Bar ── */}
        <PredictionControls
          selectedHazard={selectedHazard}
          onHazardSelect={setSelectedHazard}
          selectedHorizon={selectedHorizon}
          onHorizonSelect={setSelectedHorizon}
          horizonsData={prediction?.horizons}
          baseTime={prediction?.base_time}
        />

        {/* ── Main Geospatial & Intelligence Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Replay Controls + Station Picker (3 cols on xl) */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4 flex flex-col">
            {/* Scenario Replay & Forecast Timeline Controls */}
            <ScenarioReplayControls
              selectedHorizon={selectedHorizon}
              onHorizonSelect={setSelectedHorizon}
              baseTime={prediction?.base_time}
              targetTimes={targetTimes}
            />

            {/* Station / Point Inspector */}
            <LocationInspector
              selectedLocation={selectedLocation}
              onLocationSelect={handleLocationSelect}
              horizonsData={prediction?.horizons}
              selectedHorizon={selectedHorizon}
              selectedHazard={selectedHazard}
            />
          </div>

          {/* Center Column: High-Resolution Interactive Map (5 cols on lg, 5 on xl) */}
          <div className="lg:col-span-8 xl:col-span-5 flex flex-col min-h-[540px]">
            <MapView
              gridMap={activeGridMap}
              selectedHazard={selectedHazard}
              selectedHorizon={selectedHorizon}
              onHorizonSelect={setSelectedHorizon}
              selectedLocation={selectedLocation}
              onLocationSelect={handleLocationSelect}
              targetTime={activeTargetTime}
            />
          </div>

          {/* Right Column: Location Risk Card & Rule-Based Alert Engine (4 cols on lg/xl) */}
          <div className="lg:col-span-12 xl:col-span-4 space-y-4 flex flex-col">
            {/* Comprehensive Location Inspection Card */}
            <LocationRiskCard
              selectedLocation={selectedLocation}
              horizonsData={prediction?.horizons}
              selectedHorizon={selectedHorizon}
              onHorizonSelect={setSelectedHorizon}
              selectedHazard={selectedHazard}
              onHazardSelect={setSelectedHazard}
            />

            {/* Rule-Based Decision-Support Alert Engine */}
            <AlertEngineCard
              selectedLocation={selectedLocation}
              horizonsData={prediction?.horizons}
              selectedHorizon={selectedHorizon}
            />
          </div>
        </div>

        {/* ── Bottom Section: Trends, Operational Integration & Operational Health ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
          {/* Forecast Trend Chart (4 cols) */}
          <div className="lg:col-span-4">
            <ForecastTrendChart
              selectedLocation={selectedLocation}
              horizonsData={prediction?.horizons}
              selectedHorizon={selectedHorizon}
              onHorizonSelect={setSelectedHorizon}
            />
          </div>

          {/* Operational Integration Card (4 cols) */}
          <div className="lg:col-span-4">
            <OperationalIntegrationCard
              prediction={prediction}
              pipelineHealth={pipelineHealth}
              health={health}
            />
          </div>

          {/* Operational Health Card (4 cols) */}
          <div className="lg:col-span-4">
            <DataHealthMonitor
              prediction={prediction}
              health={health}
              pipelineHealth={pipelineHealth}
            />
          </div>
        </div>
      </main>

      {/* ── 3. Automated Situation Report Modal ── */}
      <SituationReportModal
        isOpen={isSituationReportOpen}
        onClose={() => handleNavTabChange('Home')}
        prediction={prediction}
        selectedLocation={selectedLocation}
      />

      {/* ── 4. Footer ── */}
      <footer className="border-t border-[#383838] bg-[#181818] px-6 py-4 text-center text-xs text-neutral-400 font-medium font-mono">
        Megh Setu &bull; Smart India Hackathon (SIH26084) &bull; Operational Multi-Model Satellite + NWP Nowcasting Platform
      </footer>
    </div>
  );
};

export default App;
