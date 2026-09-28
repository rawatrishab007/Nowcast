import React, { useState } from 'react';
import Navigation from './components/common/Navigation';
import Dashboard from './pages/Dashboard';
import NowcastPage from './pages/NowcastPage';
import WeatherMapPage from './pages/WeatherMapPage';
import HistoryPage from './pages/HistoryPage';
import AlertsPage from './pages/AlertsPage';
import ModelInsightsPage from './pages/ModelInsightsPage';
import SettingsPage from './pages/SettingsPage';
import Reports from './pages/Reports';
import type { Page } from './types/weather';
import { PAGE_ID_DASHBOARD } from './constants';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>(PAGE_ID_DASHBOARD);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'nowcast':
        return <NowcastPage />;
      case 'weather-map':
        return <WeatherMapPage />;
      case 'history':
        return <HistoryPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'model-insights':
        return <ModelInsightsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-300 overflow-hidden">
      <Navigation activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
