import React, { useState } from 'react';
import Page from '../components/common/Page';
import Card from '../components/common/Card';
import { WEATHER_ALERTS, LOCATIONS, NOWCAST_PREDICTIONS } from '../data/mockData';

interface DownloadItemProps {
  title: string;
  description: string;
  format: string;
  icon: string;
  onDownload: () => Promise<void> | void;
}

const DownloadItem: React.FC<DownloadItemProps> = ({ title, description, format, icon, onDownload }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleClick = async () => {
    setIsDownloading(true);
    await onDownload();
    setTimeout(() => setIsDownloading(false), 1000);
  };

  return (
    <div className="bg-gray-700/50 p-4 rounded-lg flex items-center justify-between hover:bg-gray-700 transition-colors border border-gray-700/60">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <h4 className="font-semibold text-white text-sm">{title}</h4>
          <p className="text-xs text-gray-400">{description}</p>
          <p className="text-xs text-gray-500 mt-0.5">{format}</p>
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={isDownloading}
        className={`font-bold py-1.5 px-4 rounded-lg text-sm transition-all flex-shrink-0 ${
          isDownloading ? 'bg-gray-500 text-gray-300 cursor-wait' : 'bg-teal-600 hover:bg-teal-700 text-white'
        }`}
      >
        {isDownloading ? 'Generating...' : 'Download'}
      </button>
    </div>
  );
};

const Reports: React.FC = () => {
  const triggerDownload = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. Nowcast predictions CSV
  const handleNowcastCSV = () => {
    const headers = ['Location', 'Time Offset (min)', 'Label', 'Rainfall (mm/hr)', 'Lower Bound', 'Upper Bound', 'Temperature (°C)', 'Wind (km/h)', 'Humidity (%)', 'Condition', 'Confidence (%)'];
    const rows: string[][] = [];
    Object.values(NOWCAST_PREDICTIONS).forEach(pred => {
      pred.predictions.forEach(s => {
        const loc = LOCATIONS.find(l => l.id === pred.locationId);
        rows.push([
          loc?.name ?? pred.locationId,
          String(s.minutesAhead), s.label,
          String(s.rainfall), String(s.lowerBound), String(s.upperBound),
          String(s.temperature), String(s.windSpeed),
          String(s.humidity), s.condition, String(s.confidence),
        ]);
      });
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    triggerDownload(csv, 'WeatherNow_Nowcast_Predictions.csv', 'text/csv');
  };

  // 2. Alerts log CSV
  const handleAlertsCSV = () => {
    const headers = ['ID', 'Severity', 'Title', 'Location', 'Status', 'Timestamp', 'Prediction Horizon', 'Triggered By'];
    const rows = WEATHER_ALERTS.map(a => [
      a.id, a.severity, `"${a.title}"`, a.locationName,
      a.status, a.timestamp, a.predictionHorizon, `"${a.parameterTriggered}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    triggerDownload(csv, 'WeatherNow_Alerts_Log.csv', 'text/csv');
  };

  // 3. Nowcast GeoJSON
  const handleGeoJSON = () => {
    const features = Object.values(NOWCAST_PREDICTIONS).map(pred => {
      const loc = LOCATIONS.find(l => l.id === pred.locationId);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [loc?.lng ?? 0, loc?.lat ?? 0] },
        properties: {
          location: loc?.name,
          modelRunTime: pred.modelRunTime,
          predictions: pred.predictions.map(s => ({
            minutesAhead: s.minutesAhead,
            rainfall: s.rainfall,
            lowerBound: s.lowerBound,
            upperBound: s.upperBound,
            condition: s.condition,
            confidence: s.confidence,
          })),
        },
      };
    });
    const geojson = { type: 'FeatureCollection', features };
    triggerDownload(JSON.stringify(geojson, null, 2), 'WeatherNow_Nowcast_GeoJSON.geojson', 'application/geo+json');
  };

  // 4. Mock report
  const handleMockReport = (fileName: string) =>
    new Promise<void>(resolve => {
      setTimeout(() => {
        const content = `WEATHERNOW AI — ${fileName}\n${'=' .repeat(50)}\nGenerated: ${new Date().toLocaleString()}\n\nActive Warnings: ${WEATHER_ALERTS.filter(a => a.status === 'Active').length}\nLocations Monitored: ${LOCATIONS.length}\nModel: WeatherNow-DGMR v2.3.1\n\n(DEMO MODE — Generated from WeatherNow AI frontend)\n`;
        triggerDownload(content, `${fileName}.txt`, 'text/plain');
        resolve();
      }, 1200);
    });

  return (
    <Page title="Reports & Data Exports">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="">
          <h3 className="text-white font-semibold mb-4">📥 Weather Data Exports</h3>
          <div className="space-y-3">
            <DownloadItem
              title="Nowcast Predictions (CSV)"
              description="All location prediction steps with confidence bounds"
              format="CSV Data Export"
              icon="🌧️"
              onDownload={handleNowcastCSV}
            />
            <DownloadItem
              title="Early Warning Alert Log (CSV)"
              description="Active and historical alert records"
              format="CSV Data Export"
              icon="⚠️"
              onDownload={handleAlertsCSV}
            />
            <DownloadItem
              title="Geographic Prediction Layer (GeoJSON)"
              description="Point predictions formatted for GIS systems"
              format="GeoJSON Standard"
              icon="🗺️"
              onDownload={handleGeoJSON}
            />
            <DownloadItem
              title="Executive Summary (PDF)"
              description="Automated briefing report (demo placeholder)"
              format="PDF Report Document"
              icon="📄"
              onDownload={() => handleMockReport('WeatherNow_Executive_Summary')}
            />
            <DownloadItem
              title="Radar / Map Layer Snapshot (PNG)"
              description="High-resolution visual snapshot (demo placeholder)"
              format="PNG Image Export"
              icon="🖼️"
              onDownload={() => handleMockReport('WeatherNow_Map_Snapshot')}
            />
          </div>
        </Card>

        <Card title="">
          <h3 className="text-white font-semibold mb-4">📋 Nowcast Briefing Summary</h3>
          <div className="bg-gray-900 p-4 rounded-lg space-y-4 h-full flex flex-col border border-gray-700/60">
            <div>
              <h4 className="text-teal-400 font-bold text-lg border-b border-gray-700 pb-2">WeatherNow AI — Executive Briefing</h4>
              <p className="text-gray-400 text-xs mt-1">Generated: {new Date().toLocaleString('en-IN')}</p>
            </div>
            <div className="space-y-4 text-sm text-gray-300 flex-grow">
              <div>
                <p className="font-semibold text-white">1. Monitored Geographic Range</p>
                <p className="text-gray-400 pl-4 mt-1">
                  Active monitoring across {LOCATIONS.length} key meteorological centers in India, with 10 high-resolution observation points on the geographic layer.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">2. Early Warning Status</p>
                <p className="text-gray-400 pl-4 mt-1">
                  {WEATHER_ALERTS.filter(a => a.status === 'Active').length} active early warning signals detected by the WeatherNow-DGMR model.
                  {' '}{WEATHER_ALERTS.filter(a => a.severity === 'Critical' && a.status === 'Active').length} critical severity warnings active for coastal and hill regions.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">3. Model Confidence</p>
                <p className="text-gray-400 pl-4 mt-1">
                  Average prediction confidence: 79%.
                  Short-range (0–30 min) confidence: 88–100%. Long-range (90–120 min) confidence: 66–74%.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">4. Peak Rainfall Projections</p>
                <p className="text-gray-400 pl-4 mt-1">
                  Mumbai and Guwahati projected to experience peak rainfall intensities (28.7 to 48.1 mm/hr) within the next 45 minutes.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={() => handleMockReport('WeatherNow_Executive_Briefing')}
                className="text-teal-400 hover:text-teal-300 text-sm font-semibold flex items-center justify-center w-full gap-2 transition-colors"
              >
                <span>🖨️</span> Print Executive Briefing
              </button>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
};

export default Reports;