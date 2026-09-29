// ============================================================
// WeatherNow AI — Root Application Component
// Canonical Multi-Model Nowcasting (V4 Rainfall, V3 Convection, V1 Proxies)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import type {
  UnifiedNowcastResponse,
  HealthResponse,
  WeatherLocation,
  HazardType,
} from './types/weather';
import { LOCATIONS } from './constants';
import { getUnifiedNowcast, getHealth } from './services/api';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { PredictionControls } from './components/PredictionControls';
import { LocationInspector } from './components/LocationInspector';
import { ConvectiveSummaryCard } from './components/ConvectiveSummaryCard';
import { ModelInfoPanel } from './components/ModelInfoPanel';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';

export const App: React.FC = () => {
  const [prediction, setPrediction] = useState<UnifiedNowcastResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<HazardType>('rain');
  const [selectedHorizon, setSelectedHorizon] = useState<number>(30);
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation>(LOCATIONS[0]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  // Fetch unified live predictions from the backend pipeline
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    try {
      const [pred, hlt] = await Promise.all([
        getUnifiedNowcast(forceRefresh),
        getHealth(),
      ]);
      setPrediction(pred);
      setHealth(hlt);
      setError(null);
      setErrorCode(undefined);
    } catch (err: any) {
      console.error('[WeatherNow AI] Data Pipeline Error:', err);
      setError(err?.message || 'Unable to fetch operational nowcasting predictions.');
      setErrorCode(err?.errorCode || 'PIPELINE_ERROR');
      try {
        const hlt = await getHealth();
        setHealth(hlt);
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-200 font-sans select-none antialiased">
      {/* ── 1. Top Header ── */}
      <Header
        prediction={prediction}
        health={health}
        isLoading={isLoading}
        onRefresh={() => loadData(true)}
      />

      {/* ── 2. Main Content Body ── */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-4">
        {/* Error Notification Banner */}
        {error && (
          <ErrorState
            title="Operational Data Ingestion Warning"
            message={error}
            errorCode={errorCode}
            onRetry={() => loadData(true)}
          />
        )}

        {/* Loading Overlay State if initial load */}
        {isLoading && !prediction && (
          <LoadingState
            message="Ingesting Himawari-9 Satellite & NOAA GFS Atmospheric Fields..."
            subtext="Executing multi-model inference across V4 Rainfall Nowcast, V3 Convective Cloud, and V1 Severe Weather Proxies..."
          />
        )}

        {/* Hazard & Prediction Horizons Controls */}
        <PredictionControls
          selectedHazard={selectedHazard}
          onHazardSelect={setSelectedHazard}
          selectedHorizon={selectedHorizon}
          onHorizonSelect={setSelectedHorizon}
          horizonsData={prediction?.horizons}
          baseTime={prediction?.base_time}
        />

        {/* Primary Operational Workspace: Map + Side Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left / Center: Interactive Subcontinent Nowcasting Map (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-[520px]">
            <MapView
              gridMap={activeGridMap}
              selectedHazard={selectedHazard}
              selectedHorizon={selectedHorizon}
              onHorizonSelect={setSelectedHorizon}
              selectedLocation={selectedLocation}
              onLocationSelect={setSelectedLocation}
              targetTime={activeTargetTime}
            />
          </div>

          {/* Right: Inspection, Risk Summary & Technical Model Specs (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4 flex flex-col">
            {/* Station / Point Value Inspector */}
            <LocationInspector
              selectedLocation={selectedLocation}
              onLocationSelect={setSelectedLocation}
              horizonsData={prediction?.horizons}
              selectedHorizon={selectedHorizon}
              selectedHazard={selectedHazard}
            />

            {/* Model-Aligned Risk Summary Engine */}
            <ConvectiveSummaryCard
              selectedLocation={selectedLocation}
              horizonsData={prediction?.horizons}
              selectedHorizon={selectedHorizon}
              selectedHazard={selectedHazard}
            />

            {/* Technical Multi-Model Specifications */}
            <ModelInfoPanel
              prediction={prediction}
              health={health}
            />
          </div>
        </div>
      </main>

      {/* ── 3. Footer ── */}
      <footer className="border-t border-gray-800 bg-gray-900/40 px-4 py-3 text-center text-xs text-gray-500 font-mono">
        WeatherNow AI &bull; Smart India Hackathon (SIH26084) &bull; Operational Data & Neural Multi-Model Engine
      </footer>
    </div>
  );
};

export default App;

