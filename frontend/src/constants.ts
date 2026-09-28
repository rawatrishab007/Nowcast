import type { Page } from './types/weather';
export { LOCATIONS } from './data/mockData';

export const PAGE_ID_DASHBOARD: Page = 'dashboard';
export const PAGE_ID_NOWCAST: Page = 'nowcast';
export const PAGE_ID_WEATHER_MAP: Page = 'weather-map';
export const PAGE_ID_HISTORY: Page = 'history';
export const PAGE_ID_ALERTS: Page = 'alerts';
export const PAGE_ID_MODEL_INSIGHTS: Page = 'model-insights';
export const PAGE_ID_SETTINGS: Page = 'settings';
export const PAGE_ID_REPORTS: Page = 'reports';

// Severity color definitions
export const SEVERITY_COLORS = {
  Critical: { bg: 'bg-red-900', text: 'text-red-200', border: 'border-red-700', dot: 'bg-red-500' },
  High:     { bg: 'bg-orange-900', text: 'text-orange-200', border: 'border-orange-700', dot: 'bg-orange-500' },
  Medium:   { bg: 'bg-yellow-900', text: 'text-yellow-200', border: 'border-yellow-700', dot: 'bg-yellow-500' },
  Low:      { bg: 'bg-blue-900', text: 'text-blue-200', border: 'border-blue-700', dot: 'bg-blue-500' },
  None:     { bg: 'bg-green-900', text: 'text-green-200', border: 'border-green-700', dot: 'bg-green-500' },
} as const;

export const CONDITION_ICONS: Record<string, string> = {
  'Clear': '☀️',
  'Partly Cloudy': '⛅',
  'Cloudy': '☁️',
  'Light Rain': '🌦️',
  'Moderate Rain': '🌧️',
  'Heavy Rain': '⛈️',
  'Thunderstorm': '🌩️',
  'Fog': '🌫️',
  'Haze': '🌁',
};
