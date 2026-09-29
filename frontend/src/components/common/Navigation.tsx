import React from 'react';
import type { Page } from '../../types/weather';
import {
  DashboardIcon, NowcastIcon, MapIcon, HistoryIcon, AlertIcon, ModelIcon, SettingsIcon, ReportIcon,
} from './NavIcons';

interface NavigationProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const navItems = [
  { id: 'dashboard'      as Page, label: 'Dashboard',      icon: <DashboardIcon /> },
  { id: 'nowcast'        as Page, label: 'Nowcast',         icon: <NowcastIcon />   },
  { id: 'weather-map'    as Page, label: 'Weather Map',     icon: <MapIcon />       },
  { id: 'history'        as Page, label: 'History',         icon: <HistoryIcon />   },
  { id: 'alerts'         as Page, label: 'Alerts',          icon: <AlertIcon />     },
  { id: 'model-insights' as Page, label: 'Model Insights',  icon: <ModelIcon />     },
  { id: 'reports'        as Page, label: 'Reports',         icon: <ReportIcon />    },
  { id: 'settings'       as Page, label: 'Settings',        icon: <SettingsIcon />  },
];

const Navigation: React.FC<NavigationProps> = ({ activePage, setActivePage }) => {
  return (
    <nav className="w-64 bg-gray-800 flex flex-col h-full flex-shrink-0 border-r border-gray-700/80">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-700/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">⛈️</span>
          <span className="text-white text-xl font-bold tracking-tight">WeatherNow <span className="text-teal-400">AI</span></span>
        </div>
        <p className="text-gray-400 text-xs font-medium leading-tight pl-9">AI Nowcasting & Early Warning</p>
      </div>

      {/* Nav Items */}
      <ul className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => setActivePage(item.id)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                activePage === item.id
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/30 font-semibold'
                  : 'text-gray-400 hover:bg-gray-700/80 hover:text-white font-medium'
              }`}
            >
              <span className={activePage === item.id ? 'text-white' : 'text-gray-400'}>{item.icon}</span>
              <span className="text-sm">{item.label}</span>
              {item.id === 'alerts' && activePage !== 'alerts' && (
                <span className="ml-auto bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">4</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700/80 bg-gray-800/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
          </span>
          <span className="text-teal-400 text-xs font-semibold uppercase tracking-wider">Model Active</span>
        </div>
        <p className="text-gray-500 text-xs">WeatherNow AI v2.3.1</p>
        <p className="text-gray-500 text-xs">© 2024 WeatherNow AI</p>
      </div>
    </nav>
  );
};

export default Navigation;
