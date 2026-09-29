// ============================================================
// WeatherNow AI — Meteorological Constants & Monitoring Stations
// ============================================================

import type { WeatherLocation } from './types/weather';

export const LOCATIONS: WeatherLocation[] = [
  { id: 'dehradun', name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lng: 78.0322, elevation: 640 },
  { id: 'delhi', name: 'Delhi', state: 'National Capital Territory', lat: 28.6139, lng: 77.2090, elevation: 216 },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, elevation: 14 },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, elevation: 9 },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, elevation: 920 },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, elevation: 6 },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867, elevation: 505 },
  { id: 'guwahati', name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362, elevation: 55 },
  { id: 'pune', name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, elevation: 560 },
  { id: 'bhubaneswar', name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lng: 85.8245, elevation: 45 },
  { id: 'patna', name: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376, elevation: 53 },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, elevation: 431 },
];

export const SPATIAL_BOUNDS = {
  minLat: 8.0,
  maxLat: 38.0,
  minLng: 68.0,
  maxLng: 98.0,
  height: 128,
  width: 128,
};

export const FORECAST_HORIZONS = [30, 60, 90, 120] as const;

export const PROBABILITY_THRESHOLDS = {
  CRITICAL: 0.80,
  HIGH: 0.60,
  MODERATE: 0.40,
  LOW: 0.20,
};
