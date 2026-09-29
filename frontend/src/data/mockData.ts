// ============================================================
// WeatherNow AI — Centralized Mock Data Architecture
// ============================================================
// NOTE: All values below are MOCK / DEMO DATA.
// To connect to the real ML backend:
//   1. Set VITE_API_BASE_URL in your .env file (e.g. http://localhost:8000/api)
//   2. Set VITE_USE_MOCK_DATA=false
//   3. The weatherApi service layer will dynamically make HTTP requests
// ============================================================

import type {
  WeatherLocation,
  CurrentWeather,
  NowcastPrediction,
  WeatherHistoryPoint,
  WeatherAlert,
  ModelInsights,
  WeatherMapPoint,
} from '../types/weather';

// ----------------------------------------------------------------
// 1. LOCATIONS
// ----------------------------------------------------------------
export const LOCATIONS: WeatherLocation[] = [
  { id: 'dehradun',   name: 'Dehradun',   state: 'Uttarakhand', lat: 30.3165, lng: 78.0322, elevation: 640  },
  { id: 'delhi',      name: 'Delhi',      state: 'Delhi',       lat: 28.6139, lng: 77.2090, elevation: 216  },
  { id: 'mumbai',     name: 'Mumbai',     state: 'Maharashtra', lat: 19.0760, lng: 72.8777, elevation: 11   },
  { id: 'pune',       name: 'Pune',       state: 'Maharashtra', lat: 18.5204, lng: 73.8567, elevation: 560  },
  { id: 'nashik',     name: 'Nashik',     state: 'Maharashtra', lat: 19.9975, lng: 73.7898, elevation: 565  },
  { id: 'bengaluru',  name: 'Bengaluru',  state: 'Karnataka',   lat: 12.9716, lng: 77.5946, elevation: 920  },
  { id: 'guwahati',   name: 'Guwahati',   state: 'Assam',       lat: 26.1445, lng: 91.7362, elevation: 55   },
];

// ----------------------------------------------------------------
// 2. CURRENT WEATHER SUMMARY (per location)
// ----------------------------------------------------------------
export const CURRENT_WEATHER: Record<string, CurrentWeather> = {
  dehradun: {
    locationId: 'dehradun',
    timestamp: new Date().toISOString(),
    temperature: 24.6, feelsLike: 26.1, humidity: 78,
    rainfall: 12.4, windSpeed: 18, windDirection: 'SW',
    condition: 'Moderate Rain', visibility: 4.2,
    pressure: 1008, dewPoint: 20.4, uvIndex: 2,
  },
  delhi: {
    locationId: 'delhi',
    timestamp: new Date().toISOString(),
    temperature: 33.2, feelsLike: 36.8, humidity: 60,
    rainfall: 0.0, windSpeed: 12, windDirection: 'NW',
    condition: 'Partly Cloudy', visibility: 7.0,
    pressure: 1004, dewPoint: 24.2, uvIndex: 6,
  },
  mumbai: {
    locationId: 'mumbai',
    timestamp: new Date().toISOString(),
    temperature: 28.4, feelsLike: 32.0, humidity: 88,
    rainfall: 28.7, windSpeed: 32, windDirection: 'W',
    condition: 'Heavy Rain', visibility: 2.1,
    pressure: 1006, dewPoint: 26.0, uvIndex: 1,
  },
  pune: {
    locationId: 'pune',
    timestamp: new Date().toISOString(),
    temperature: 26.1, feelsLike: 27.5, humidity: 72,
    rainfall: 8.1, windSpeed: 14, windDirection: 'SW',
    condition: 'Light Rain', visibility: 5.8,
    pressure: 1010, dewPoint: 21.0, uvIndex: 3,
  },
  nashik: {
    locationId: 'nashik',
    timestamp: new Date().toISOString(),
    temperature: 25.3, feelsLike: 26.0, humidity: 74,
    rainfall: 5.2, windSpeed: 10, windDirection: 'SE',
    condition: 'Cloudy', visibility: 6.5,
    pressure: 1009, dewPoint: 20.5, uvIndex: 2,
  },
  bengaluru: {
    locationId: 'bengaluru',
    timestamp: new Date().toISOString(),
    temperature: 22.8, feelsLike: 23.0, humidity: 65,
    rainfall: 0.0, windSpeed: 8, windDirection: 'E',
    condition: 'Clear', visibility: 10.0,
    pressure: 1012, dewPoint: 15.8, uvIndex: 7,
  },
  guwahati: {
    locationId: 'guwahati',
    timestamp: new Date().toISOString(),
    temperature: 29.7, feelsLike: 34.2, humidity: 84,
    rainfall: 18.6, windSpeed: 22, windDirection: 'S',
    condition: 'Heavy Rain', visibility: 3.0,
    pressure: 1003, dewPoint: 26.8, uvIndex: 1,
  },
};

// ----------------------------------------------------------------
// 3. NOWCAST PREDICTIONS (Separate Observations & Predictions Arrays)
// ----------------------------------------------------------------
// Separate datasets for past historical observations (-60m..NOW)
// and future ML model predictions (NOW..+120m).
export const NOWCAST_PREDICTIONS: Record<string, NowcastPrediction> = {
  dehradun: {
    locationId: 'dehradun',
    modelRunTime: new Date().toISOString(),
    predictionHorizonMin: 120,
    observations: [
      { minutesAgo: 60, label: '-60 min', timestamp: new Date(Date.now() - 3600000).toISOString(), rainfall: 4.2,  temperature: 26.0, humidity: 70, windSpeed: 12, pressure: 1010, condition: 'Light Rain' },
      { minutesAgo: 45, label: '-45 min', timestamp: new Date(Date.now() - 2700000).toISOString(), rainfall: 6.8,  temperature: 25.6, humidity: 72, windSpeed: 14, pressure: 1009, condition: 'Light Rain' },
      { minutesAgo: 30, label: '-30 min', timestamp: new Date(Date.now() - 1800000).toISOString(), rainfall: 9.1,  temperature: 25.2, humidity: 75, windSpeed: 15, pressure: 1008, condition: 'Moderate Rain' },
      { minutesAgo: 15, label: '-15 min', timestamp: new Date(Date.now() - 900000).toISOString(),  rainfall: 11.0, temperature: 24.8, humidity: 77, windSpeed: 17, pressure: 1008, condition: 'Moderate Rain' },
      { minutesAgo: 0,  label: 'Now',     timestamp: new Date().toISOString(),                     rainfall: 12.4, temperature: 24.6, humidity: 78, windSpeed: 18, pressure: 1008, condition: 'Moderate Rain' },
    ],
    predictions: [
      { minutesAhead: 0,   label: 'Now',      rainfall: 12.4, lowerBound: 12.4, upperBound: 12.4, confidence: 100, temperature: 24.6, windSpeed: 18, humidity: 78, condition: 'Moderate Rain' },
      { minutesAhead: 15,  label: '+15 min',  rainfall: 18.2, lowerBound: 15.1, upperBound: 22.4, confidence: 91,  temperature: 24.2, windSpeed: 21, humidity: 80, condition: 'Moderate Rain' },
      { minutesAhead: 30,  label: '+30 min',  rainfall: 24.5, lowerBound: 19.2, upperBound: 30.8, confidence: 88,  temperature: 23.8, windSpeed: 25, humidity: 83, condition: 'Heavy Rain' },
      { minutesAhead: 45,  label: '+45 min',  rainfall: 28.1, lowerBound: 21.0, upperBound: 37.4, confidence: 84,  temperature: 23.4, windSpeed: 27, humidity: 85, condition: 'Heavy Rain' },
      { minutesAhead: 60,  label: '+60 min',  rainfall: 31.2, lowerBound: 22.5, upperBound: 42.1, confidence: 82,  temperature: 23.0, windSpeed: 29, humidity: 87, condition: 'Heavy Rain' },
      { minutesAhead: 90,  label: '+90 min',  rainfall: 22.4, lowerBound: 12.8, upperBound: 35.2, confidence: 74,  temperature: 22.8, windSpeed: 24, humidity: 84, condition: 'Moderate Rain' },
      { minutesAhead: 120, label: '+120 min', rainfall: 14.8, lowerBound: 5.2,  upperBound: 28.6, confidence: 66,  temperature: 22.5, windSpeed: 20, humidity: 82, condition: 'Light Rain' },
    ],
  },
  mumbai: {
    locationId: 'mumbai',
    modelRunTime: new Date().toISOString(),
    predictionHorizonMin: 120,
    observations: [
      { minutesAgo: 60, label: '-60 min', timestamp: new Date(Date.now() - 3600000).toISOString(), rainfall: 18.2, temperature: 29.5, humidity: 82, windSpeed: 24, pressure: 1008, condition: 'Moderate Rain' },
      { minutesAgo: 45, label: '-45 min', timestamp: new Date(Date.now() - 2700000).toISOString(), rainfall: 21.5, temperature: 29.1, humidity: 84, windSpeed: 26, pressure: 1007, condition: 'Heavy Rain' },
      { minutesAgo: 30, label: '-30 min', timestamp: new Date(Date.now() - 1800000).toISOString(), rainfall: 25.0, temperature: 28.8, humidity: 86, windSpeed: 28, pressure: 1007, condition: 'Heavy Rain' },
      { minutesAgo: 15, label: '-15 min', timestamp: new Date(Date.now() - 900000).toISOString(),  rainfall: 27.2, temperature: 28.5, humidity: 87, windSpeed: 30, pressure: 1006, condition: 'Heavy Rain' },
      { minutesAgo: 0,  label: 'Now',     timestamp: new Date().toISOString(),                     rainfall: 28.7, temperature: 28.4, humidity: 88, windSpeed: 32, pressure: 1006, condition: 'Heavy Rain' },
    ],
    predictions: [
      { minutesAhead: 0,   label: 'Now',      rainfall: 28.7, lowerBound: 28.7, upperBound: 28.7, confidence: 100, temperature: 28.4, windSpeed: 32, humidity: 88, condition: 'Heavy Rain' },
      { minutesAhead: 15,  label: '+15 min',  rainfall: 34.2, lowerBound: 28.8, upperBound: 40.5, confidence: 93,  temperature: 28.0, windSpeed: 35, humidity: 90, condition: 'Heavy Rain' },
      { minutesAhead: 30,  label: '+30 min',  rainfall: 42.6, lowerBound: 34.2, upperBound: 52.4, confidence: 89,  temperature: 27.6, windSpeed: 38, humidity: 92, condition: 'Thunderstorm' },
      { minutesAhead: 45,  label: '+45 min',  rainfall: 48.1, lowerBound: 36.4, upperBound: 62.0, confidence: 85,  temperature: 27.2, windSpeed: 40, humidity: 93, condition: 'Thunderstorm' },
      { minutesAhead: 60,  label: '+60 min',  rainfall: 39.4, lowerBound: 25.0, upperBound: 56.8, confidence: 78,  temperature: 27.0, windSpeed: 36, humidity: 91, condition: 'Heavy Rain' },
      { minutesAhead: 90,  label: '+90 min',  rainfall: 28.0, lowerBound: 12.2, upperBound: 48.2, confidence: 70,  temperature: 26.8, windSpeed: 30, humidity: 89, condition: 'Heavy Rain' },
      { minutesAhead: 120, label: '+120 min', rainfall: 18.5, lowerBound: 4.5,  upperBound: 38.0, confidence: 62,  temperature: 26.6, windSpeed: 25, humidity: 87, condition: 'Moderate Rain' },
    ],
  },
  delhi: {
    locationId: 'delhi',
    modelRunTime: new Date().toISOString(),
    predictionHorizonMin: 120,
    observations: [
      { minutesAgo: 60, label: '-60 min', timestamp: new Date(Date.now() - 3600000).toISOString(), rainfall: 0.0, temperature: 34.5, humidity: 55, windSpeed: 10, pressure: 1006, condition: 'Clear' },
      { minutesAgo: 45, label: '-45 min', timestamp: new Date(Date.now() - 2700000).toISOString(), rainfall: 0.0, temperature: 34.1, humidity: 57, windSpeed: 11, pressure: 1005, condition: 'Partly Cloudy' },
      { minutesAgo: 30, label: '-30 min', timestamp: new Date(Date.now() - 1800000).toISOString(), rainfall: 0.0, temperature: 33.8, humidity: 58, windSpeed: 11, pressure: 1005, condition: 'Partly Cloudy' },
      { minutesAgo: 15, label: '-15 min', timestamp: new Date(Date.now() - 900000).toISOString(),  rainfall: 0.0, temperature: 33.5, humidity: 59, windSpeed: 12, pressure: 1004, condition: 'Partly Cloudy' },
      { minutesAgo: 0,  label: 'Now',     timestamp: new Date().toISOString(),                     rainfall: 0.0, temperature: 33.2, humidity: 60, windSpeed: 12, pressure: 1004, condition: 'Partly Cloudy' },
    ],
    predictions: [
      { minutesAhead: 0,   label: 'Now',      rainfall: 0.0, lowerBound: 0.0, upperBound: 0.0,  confidence: 100, temperature: 33.2, windSpeed: 12, humidity: 60, condition: 'Partly Cloudy' },
      { minutesAhead: 15,  label: '+15 min',  rainfall: 0.2, lowerBound: 0.0, upperBound: 1.5,  confidence: 88,  temperature: 33.0, windSpeed: 13, humidity: 62, condition: 'Partly Cloudy' },
      { minutesAhead: 30,  label: '+30 min',  rainfall: 1.4, lowerBound: 0.0, upperBound: 5.2,  confidence: 82,  temperature: 32.4, windSpeed: 15, humidity: 66, condition: 'Cloudy' },
      { minutesAhead: 45,  label: '+45 min',  rainfall: 4.2, lowerBound: 0.5, upperBound: 10.4, confidence: 76,  temperature: 31.8, windSpeed: 18, humidity: 70, condition: 'Light Rain' },
      { minutesAhead: 60,  label: '+60 min',  rainfall: 7.8, lowerBound: 2.0, upperBound: 15.8, confidence: 70,  temperature: 31.0, windSpeed: 20, humidity: 75, condition: 'Moderate Rain' },
      { minutesAhead: 90,  label: '+90 min',  rainfall: 6.2, lowerBound: 0.0, upperBound: 18.2, confidence: 62,  temperature: 30.5, windSpeed: 18, humidity: 74, condition: 'Light Rain' },
      { minutesAhead: 120, label: '+120 min', rainfall: 3.0, lowerBound: 0.0, upperBound: 14.0, confidence: 54,  temperature: 30.0, windSpeed: 15, humidity: 72, condition: 'Light Rain' },
    ],
  },
  pune: {
    locationId: 'pune',
    modelRunTime: new Date().toISOString(),
    predictionHorizonMin: 120,
    observations: [
      { minutesAgo: 60, label: '-60 min', timestamp: new Date(Date.now() - 3600000).toISOString(), rainfall: 3.0, temperature: 27.2, humidity: 68, windSpeed: 10, pressure: 1012, condition: 'Cloudy' },
      { minutesAgo: 45, label: '-45 min', timestamp: new Date(Date.now() - 2700000).toISOString(), rainfall: 4.5, temperature: 26.9, humidity: 69, windSpeed: 11, pressure: 1011, condition: 'Light Rain' },
      { minutesAgo: 30, label: '-30 min', timestamp: new Date(Date.now() - 1800000).toISOString(), rainfall: 6.0, temperature: 26.6, humidity: 70, windSpeed: 12, pressure: 1011, condition: 'Light Rain' },
      { minutesAgo: 15, label: '-15 min', timestamp: new Date(Date.now() - 900000).toISOString(),  rainfall: 7.2, temperature: 26.3, humidity: 71, windSpeed: 13, pressure: 1010, condition: 'Light Rain' },
      { minutesAgo: 0,  label: 'Now',     timestamp: new Date().toISOString(),                     rainfall: 8.1, temperature: 26.1, humidity: 72, windSpeed: 14, pressure: 1010, condition: 'Light Rain' },
    ],
    predictions: [
      { minutesAhead: 0,   label: 'Now',      rainfall: 8.1,  lowerBound: 8.1, upperBound: 8.1,  confidence: 100, temperature: 26.1, windSpeed: 14, humidity: 72, condition: 'Light Rain' },
      { minutesAhead: 15,  label: '+15 min',  rainfall: 9.8,  lowerBound: 7.0, upperBound: 13.2, confidence: 88,  temperature: 25.8, windSpeed: 15, humidity: 74, condition: 'Light Rain' },
      { minutesAhead: 30,  label: '+30 min',  rainfall: 12.5, lowerBound: 8.0, upperBound: 18.5, confidence: 81,  temperature: 25.5, windSpeed: 17, humidity: 77, condition: 'Moderate Rain' },
      { minutesAhead: 45,  label: '+45 min',  rainfall: 10.2, lowerBound: 4.5, upperBound: 18.0, confidence: 74,  temperature: 25.2, windSpeed: 15, humidity: 76, condition: 'Moderate Rain' },
      { minutesAhead: 60,  label: '+60 min',  rainfall: 7.8,  lowerBound: 1.5, upperBound: 16.2, confidence: 68,  temperature: 25.0, windSpeed: 13, humidity: 74, condition: 'Light Rain' },
      { minutesAhead: 90,  label: '+90 min',  rainfall: 5.2,  lowerBound: 0.0, upperBound: 14.0, confidence: 60,  temperature: 24.8, windSpeed: 11, humidity: 72, condition: 'Light Rain' },
      { minutesAhead: 120, label: '+120 min', rainfall: 3.0,  lowerBound: 0.0, upperBound: 10.5, confidence: 52,  temperature: 24.6, windSpeed: 9,  humidity: 70, condition: 'Cloudy' },
    ],
  },
  nashik: {
    locationId: 'nashik',
    modelRunTime: new Date().toISOString(),
    predictionHorizonMin: 120,
    observations: [
      { minutesAgo: 60, label: '-60 min', timestamp: new Date(Date.now() - 3600000).toISOString(), rainfall: 1.5, temperature: 26.5, humidity: 70, windSpeed: 8,  pressure: 1011, condition: 'Cloudy' },
      { minutesAgo: 45, label: '-45 min', timestamp: new Date(Date.now() - 2700000).toISOString(), rainfall: 2.8, temperature: 26.1, humidity: 71, windSpeed: 9,  pressure: 1010, condition: 'Cloudy' },
      { minutesAgo: 30, label: '-30 min', timestamp: new Date(Date.now() - 1800000).toISOString(), rainfall: 3.9, temperature: 25.8, humidity: 72, windSpeed: 9,  pressure: 1010, condition: 'Cloudy' },
      { minutesAgo: 15, label: '-15 min', timestamp: new Date(Date.now() - 900000).toISOString(),  rainfall: 4.5, temperature: 25.5, humidity: 73, windSpeed: 10, pressure: 1009, condition: 'Cloudy' },
      { minutesAgo: 0,  label: 'Now',     timestamp: new Date().toISOString(),                     rainfall: 5.2, temperature: 25.3, humidity: 74, windSpeed: 10, pressure: 1009, condition: 'Cloudy' },
    ],
    predictions: [
      { minutesAhead: 0,   label: 'Now',      rainfall: 5.2, lowerBound: 5.2, upperBound: 5.2,  confidence: 100, temperature: 25.3, windSpeed: 10, humidity: 74, condition: 'Cloudy' },
      { minutesAhead: 15,  label: '+15 min',  rainfall: 6.8, lowerBound: 3.5, upperBound: 10.2, confidence: 84,  temperature: 25.0, windSpeed: 11, humidity: 76, condition: 'Light Rain' },
      { minutesAhead: 30,  label: '+30 min',  rainfall: 8.4, lowerBound: 4.0, upperBound: 14.5, confidence: 77,  temperature: 24.7, windSpeed: 13, humidity: 78, condition: 'Light Rain' },
      { minutesAhead: 45,  label: '+45 min',  rainfall: 7.2, lowerBound: 2.0, upperBound: 14.0, confidence: 70,  temperature: 24.5, windSpeed: 12, humidity: 77, condition: 'Light Rain' },
      { minutesAhead: 60,  label: '+60 min',  rainfall: 5.8, lowerBound: 0.0, upperBound: 13.2, confidence: 63,  temperature: 24.3, windSpeed: 10, humidity: 76, condition: 'Cloudy' },
      { minutesAhead: 90,  label: '+90 min',  rainfall: 4.0, lowerBound: 0.0, upperBound: 12.0, confidence: 55,  temperature: 24.1, windSpeed: 9,  humidity: 74, condition: 'Cloudy' },
      { minutesAhead: 120, label: '+120 min', rainfall: 2.5, lowerBound: 0.0, upperBound: 9.0,  confidence: 48,  temperature: 24.0, windSpeed: 8,  humidity: 72, condition: 'Partly Cloudy' },
    ],
  },
  bengaluru: {
    locationId: 'bengaluru',
    modelRunTime: new Date().toISOString(),
    predictionHorizonMin: 120,
    observations: [
      { minutesAgo: 60, label: '-60 min', timestamp: new Date(Date.now() - 3600000).toISOString(), rainfall: 0.0, temperature: 23.5, humidity: 62, windSpeed: 7, pressure: 1014, condition: 'Clear' },
      { minutesAgo: 45, label: '-45 min', timestamp: new Date(Date.now() - 2700000).toISOString(), rainfall: 0.0, temperature: 23.2, humidity: 63, windSpeed: 7, pressure: 1013, condition: 'Clear' },
      { minutesAgo: 30, label: '-30 min', timestamp: new Date(Date.now() - 1800000).toISOString(), rainfall: 0.0, temperature: 23.0, humidity: 64, windSpeed: 8, pressure: 1013, condition: 'Clear' },
      { minutesAgo: 15, label: '-15 min', timestamp: new Date(Date.now() - 900000).toISOString(),  rainfall: 0.0, temperature: 22.9, humidity: 64, windSpeed: 8, pressure: 1012, condition: 'Clear' },
      { minutesAgo: 0,  label: 'Now',     timestamp: new Date().toISOString(),                     rainfall: 0.0, temperature: 22.8, humidity: 65, windSpeed: 8, pressure: 1012, condition: 'Clear' },
    ],
    predictions: [
      { minutesAhead: 0,   label: 'Now',      rainfall: 0.0, lowerBound: 0.0, upperBound: 0.0, confidence: 100, temperature: 22.8, windSpeed: 8,  humidity: 65, condition: 'Clear' },
      { minutesAhead: 15,  label: '+15 min',  rainfall: 0.0, lowerBound: 0.0, upperBound: 0.5, confidence: 94,  temperature: 22.8, windSpeed: 8,  humidity: 65, condition: 'Clear' },
      { minutesAhead: 30,  label: '+30 min',  rainfall: 0.2, lowerBound: 0.0, upperBound: 2.0, confidence: 86,  temperature: 22.6, windSpeed: 9,  humidity: 66, condition: 'Partly Cloudy' },
      { minutesAhead: 45,  label: '+45 min',  rainfall: 0.8, lowerBound: 0.0, upperBound: 4.2, confidence: 78,  temperature: 22.4, windSpeed: 10, humidity: 68, condition: 'Partly Cloudy' },
      { minutesAhead: 60,  label: '+60 min',  rainfall: 2.5, lowerBound: 0.0, upperBound: 7.8, confidence: 71,  temperature: 22.2, windSpeed: 11, humidity: 70, condition: 'Light Rain' },
      { minutesAhead: 90,  label: '+90 min',  rainfall: 1.8, lowerBound: 0.0, upperBound: 6.5, confidence: 62,  temperature: 22.0, windSpeed: 10, humidity: 69, condition: 'Partly Cloudy' },
      { minutesAhead: 120, label: '+120 min', rainfall: 0.5, lowerBound: 0.0, upperBound: 4.2, confidence: 54,  temperature: 21.8, windSpeed: 9,  humidity: 68, condition: 'Partly Cloudy' },
    ],
  },
  guwahati: {
    locationId: 'guwahati',
    modelRunTime: new Date().toISOString(),
    predictionHorizonMin: 120,
    observations: [
      { minutesAgo: 60, label: '-60 min', timestamp: new Date(Date.now() - 3600000).toISOString(), rainfall: 10.5, temperature: 31.0, humidity: 78, windSpeed: 16, pressure: 1005, condition: 'Moderate Rain' },
      { minutesAgo: 45, label: '-45 min', timestamp: new Date(Date.now() - 2700000).toISOString(), rainfall: 12.8, temperature: 30.6, humidity: 80, windSpeed: 18, pressure: 1004, condition: 'Moderate Rain' },
      { minutesAgo: 30, label: '-30 min', timestamp: new Date(Date.now() - 1800000).toISOString(), rainfall: 15.0, temperature: 30.2, humidity: 81, windSpeed: 19, pressure: 1004, condition: 'Moderate Rain' },
      { minutesAgo: 15, label: '-15 min', timestamp: new Date(Date.now() - 900000).toISOString(),  rainfall: 17.1, temperature: 29.9, humidity: 83, windSpeed: 21, pressure: 1003, condition: 'Heavy Rain' },
      { minutesAgo: 0,  label: 'Now',     timestamp: new Date().toISOString(),                     rainfall: 18.6, temperature: 29.7, humidity: 84, windSpeed: 22, pressure: 1003, condition: 'Heavy Rain' },
    ],
    predictions: [
      { minutesAhead: 0,   label: 'Now',      rainfall: 18.6, lowerBound: 18.6, upperBound: 18.6, confidence: 100, temperature: 29.7, windSpeed: 22, humidity: 84, condition: 'Heavy Rain' },
      { minutesAhead: 15,  label: '+15 min',  rainfall: 24.8, lowerBound: 19.2, upperBound: 31.5, confidence: 90,  temperature: 29.2, windSpeed: 26, humidity: 86, condition: 'Heavy Rain' },
      { minutesAhead: 30,  label: '+30 min',  rainfall: 32.5, lowerBound: 24.0, upperBound: 42.8, confidence: 86,  temperature: 28.8, windSpeed: 30, humidity: 88, condition: 'Thunderstorm' },
      { minutesAhead: 45,  label: '+45 min',  rainfall: 38.2, lowerBound: 26.5, upperBound: 51.2, confidence: 81,  temperature: 28.4, windSpeed: 33, humidity: 89, condition: 'Thunderstorm' },
      { minutesAhead: 60,  label: '+60 min',  rainfall: 42.0, lowerBound: 28.0, upperBound: 58.4, confidence: 75,  temperature: 28.0, windSpeed: 35, humidity: 90, condition: 'Thunderstorm' },
      { minutesAhead: 90,  label: '+90 min',  rainfall: 30.4, lowerBound: 14.0, upperBound: 50.2, confidence: 66,  temperature: 27.8, windSpeed: 28, humidity: 88, condition: 'Heavy Rain' },
      { minutesAhead: 120, label: '+120 min', rainfall: 20.0, lowerBound: 5.0,  upperBound: 40.5, confidence: 58,  temperature: 27.5, windSpeed: 24, humidity: 86, condition: 'Heavy Rain' },
    ],
  },
};

// ----------------------------------------------------------------
// 4. WEATHER HISTORY (Last 24 Hours, Hourly Observations)
// ----------------------------------------------------------------
function generateHistory(baseRainfall: number, baseTemp: number, baseHumidity: number, baseWind: number): WeatherHistoryPoint[] {
  const now = new Date();
  return Array.from({ length: 25 }, (_, i) => {
    const t = new Date(now.getTime() - (24 - i) * 60 * 60 * 1000);
    const hour = t.getHours();
    const rand = (a: number, b: number) => parseFloat((a + Math.random() * (b - a)).toFixed(1));
    const rainfallVariance = Math.sin((hour / 24) * Math.PI * 2) * 8 + rand(-3, 3);
    return {
      timestamp: t.toISOString(),
      time: t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      rainfall: Math.max(0, parseFloat((baseRainfall + rainfallVariance).toFixed(1))),
      temperature: parseFloat((baseTemp + Math.sin(hour / 6) * 4 + rand(-1, 1)).toFixed(1)),
      humidity: Math.min(100, Math.max(30, Math.round(baseHumidity + Math.cos(hour / 8) * 8 + rand(-3, 3)))),
      windSpeed: Math.max(0, parseFloat((baseWind + rand(-5, 5)).toFixed(1))),
      pressure: parseFloat((1008 + rand(-4, 4)).toFixed(1)),
    };
  });
}

export const WEATHER_HISTORY: Record<string, WeatherHistoryPoint[]> = {
  dehradun:  generateHistory(10, 23, 75, 16),
  delhi:     generateHistory(1,  32, 58, 11),
  mumbai:    generateHistory(24, 27, 87, 30),
  pune:      generateHistory(6,  25, 70, 13),
  nashik:    generateHistory(4,  24, 72, 9),
  bengaluru: generateHistory(0.5, 22, 63, 7),
  guwahati:  generateHistory(16, 28, 82, 20),
};

// ----------------------------------------------------------------
// 5. WEATHER ALERTS (Demo Warnings)
// ----------------------------------------------------------------
export const WEATHER_ALERTS: WeatherAlert[] = [
  {
    id: 'alert-001',
    severity: 'High',
    title: 'Heavy Rainfall Expected',
    description: 'Rainfall intensity projected to exceed 30 mm/hr within 30 minutes. Risk of localized waterlogging and flash flooding in low-lying areas.',
    locationId: 'dehradun', locationName: 'Dehradun, Uttarakhand',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
    predictionHorizon: '30 min', status: 'Active', icon: '🌧️',
    parameterTriggered: 'Rainfall > 30 mm/hr (predicted)',
  },
  {
    id: 'alert-002',
    severity: 'Critical',
    title: 'Thunderstorm Alert',
    description: 'Severe thunderstorm cell detected approaching coastal region. Lightning risk is HIGH. Wind gusts expected to reach 55+ km/h.',
    locationId: 'mumbai', locationName: 'Mumbai, Maharashtra',
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60000).toISOString(),
    predictionHorizon: '45 min', status: 'Active', icon: '⛈️',
    parameterTriggered: 'Wind Speed > 50 km/h + Rainfall > 40 mm/hr',
  },
  {
    id: 'alert-003',
    severity: 'High',
    title: 'Extreme Rainfall Escalation',
    description: 'Rapid escalation in rainfall intensity observed. Model forecasts peak of 42 mm/hr in next 60 minutes. High confidence (75%).',
    locationId: 'guwahati', locationName: 'Guwahati, Assam',
    timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
    predictionHorizon: '60 min', status: 'Active', icon: '🌩️',
    parameterTriggered: 'Rainfall escalation rate > 2 mm/hr·min',
  },
  {
    id: 'alert-004',
    severity: 'Medium',
    title: 'Rainfall Onset Predicted',
    description: 'Dry spell ending. Rain expected within 30–60 minutes based on approaching cloud mass. Confidence 70%.',
    locationId: 'delhi', locationName: 'Delhi',
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    predictionHorizon: '60 min', status: 'Active', icon: '🌦️',
    parameterTriggered: 'Rainfall onset probability > 70%',
  },
  {
    id: 'alert-005',
    severity: 'Low',
    title: 'Reduced Visibility',
    description: 'Visibility dropped to 2.1 km due to heavy rain. Road and air traffic advisories may apply.',
    locationId: 'mumbai', locationName: 'Mumbai, Maharashtra',
    timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    predictionHorizon: '30 min', status: 'Monitoring', icon: '🌫️',
    parameterTriggered: 'Visibility < 3 km',
  },
  {
    id: 'alert-006',
    severity: 'Medium',
    title: 'Wind Speed Elevated',
    description: 'Sustained wind speed above 30 km/h with gusts up to 38 km/h. Loose structures may be affected.',
    locationId: 'pune', locationName: 'Pune, Maharashtra',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 40 * 60000).toISOString(),
    predictionHorizon: '45 min', status: 'Resolved', icon: '💨',
    parameterTriggered: 'Wind Speed > 30 km/h',
  },
];

// ----------------------------------------------------------------
// 6. MODEL INSIGHTS TELEMETRY
// ----------------------------------------------------------------
export const MODEL_INSIGHTS: ModelInsights = {
  modelName: 'WeatherNow-DGMR',
  modelVersion: 'v2.3.1',
  status: 'Active',
  predictionHorizonMin: 120,
  lastInferenceTime: new Date(Date.now() - 118000).toISOString(),
  inferenceLatencyMs: 1840,
  averageConfidence: 79,
  observationsUsed: 312,
  inputDataTimestamp: new Date(Date.now() - 300000).toISOString(),
  dataFreshnessMin: 5,
  radarDataAvailable: true,
  satelliteDataAvailable: true,
  groundStationCount: 47,
};

// ----------------------------------------------------------------
// 7. WEATHER MAP POINTS
// ----------------------------------------------------------------
export const WEATHER_MAP_POINTS: Record<number, WeatherMapPoint[]> = {
  0: [
    { id: 'mp-dehradun',  name: 'Dehradun',   lat: 30.316, lng: 78.032, rainfall: 12.4, intensity: 'Moderate', temperature: 24.6, windSpeed: 18, condition: 'Moderate Rain', alertLevel: 'High'     },
    { id: 'mp-delhi',     name: 'Delhi',       lat: 28.614, lng: 77.209, rainfall: 0.0,  intensity: 'None',     temperature: 33.2, windSpeed: 12, condition: 'Partly Cloudy', alertLevel: 'Medium'   },
    { id: 'mp-mumbai',    name: 'Mumbai',      lat: 19.076, lng: 72.878, rainfall: 28.7, intensity: 'Heavy',    temperature: 28.4, windSpeed: 32, condition: 'Heavy Rain',    alertLevel: 'Critical' },
    { id: 'mp-pune',      name: 'Pune',        lat: 18.520, lng: 73.857, rainfall: 8.1,  intensity: 'Light',    temperature: 26.1, windSpeed: 14, condition: 'Light Rain',    alertLevel: 'None'     },
    { id: 'mp-nashik',    name: 'Nashik',      lat: 19.997, lng: 73.790, rainfall: 5.2,  intensity: 'Light',    temperature: 25.3, windSpeed: 10, condition: 'Cloudy',        alertLevel: 'None'     },
    { id: 'mp-bengaluru', name: 'Bengaluru',   lat: 12.972, lng: 77.595, rainfall: 0.0,  intensity: 'None',     temperature: 22.8, windSpeed: 8,  condition: 'Clear',         alertLevel: 'None'     },
    { id: 'mp-guwahati',  name: 'Guwahati',    lat: 26.144, lng: 91.736, rainfall: 18.6, intensity: 'Heavy',    temperature: 29.7, windSpeed: 22, condition: 'Heavy Rain',    alertLevel: 'High'     },
    { id: 'mp-kolkata',   name: 'Kolkata',     lat: 22.573, lng: 88.364, rainfall: 7.2,  intensity: 'Light',    temperature: 30.1, windSpeed: 15, condition: 'Light Rain',    alertLevel: 'Low'      },
    { id: 'mp-chennai',   name: 'Chennai',     lat: 13.083, lng: 80.271, rainfall: 0.2,  intensity: 'None',     temperature: 31.8, windSpeed: 10, condition: 'Partly Cloudy', alertLevel: 'None'     },
    { id: 'mp-hyderabad', name: 'Hyderabad',   lat: 17.387, lng: 78.491, rainfall: 4.8,  intensity: 'Light',    temperature: 28.5, windSpeed: 12, condition: 'Light Rain',    alertLevel: 'None'     },
  ],
  30: [
    { id: 'mp-dehradun',  name: 'Dehradun',   lat: 30.316, lng: 78.032, rainfall: 24.5, intensity: 'Heavy',    temperature: 23.8, windSpeed: 25, condition: 'Heavy Rain',    alertLevel: 'High'     },
    { id: 'mp-delhi',     name: 'Delhi',       lat: 28.614, lng: 77.209, rainfall: 1.4,  intensity: 'Light',    temperature: 32.4, windSpeed: 15, condition: 'Cloudy',        alertLevel: 'Medium'   },
    { id: 'mp-mumbai',    name: 'Mumbai',      lat: 19.076, lng: 72.878, rainfall: 42.6, intensity: 'Extreme',  temperature: 27.6, windSpeed: 38, condition: 'Thunderstorm',  alertLevel: 'Critical' },
    { id: 'mp-pune',      name: 'Pune',        lat: 18.520, lng: 73.857, rainfall: 12.5, intensity: 'Moderate', temperature: 25.5, windSpeed: 17, condition: 'Moderate Rain', alertLevel: 'None'     },
    { id: 'mp-nashik',    name: 'Nashik',      lat: 19.997, lng: 73.790, rainfall: 8.4,  intensity: 'Light',    temperature: 24.7, windSpeed: 13, condition: 'Light Rain',    alertLevel: 'None'     },
    { id: 'mp-bengaluru', name: 'Bengaluru',   lat: 12.972, lng: 77.595, rainfall: 0.2,  intensity: 'None',     temperature: 22.6, windSpeed: 9,  condition: 'Partly Cloudy', alertLevel: 'None'     },
    { id: 'mp-guwahati',  name: 'Guwahati',    lat: 26.144, lng: 91.736, rainfall: 32.5, intensity: 'Extreme',  temperature: 28.8, windSpeed: 30, condition: 'Thunderstorm',  alertLevel: 'High'     },
    { id: 'mp-kolkata',   name: 'Kolkata',     lat: 22.573, lng: 88.364, rainfall: 10.4, intensity: 'Moderate', temperature: 29.5, windSpeed: 18, condition: 'Moderate Rain', alertLevel: 'Low'      },
    { id: 'mp-chennai',   name: 'Chennai',     lat: 13.083, lng: 80.271, rainfall: 0.8,  intensity: 'Light',    temperature: 31.2, windSpeed: 11, condition: 'Cloudy',        alertLevel: 'None'     },
    { id: 'mp-hyderabad', name: 'Hyderabad',   lat: 17.387, lng: 78.491, rainfall: 6.5,  intensity: 'Light',    temperature: 27.8, windSpeed: 14, condition: 'Light Rain',    alertLevel: 'None'     },
  ],
  60: [
    { id: 'mp-dehradun',  name: 'Dehradun',   lat: 30.316, lng: 78.032, rainfall: 31.2, intensity: 'Heavy',    temperature: 23.0, windSpeed: 29, condition: 'Heavy Rain',    alertLevel: 'High'     },
    { id: 'mp-delhi',     name: 'Delhi',       lat: 28.614, lng: 77.209, rainfall: 7.8,  intensity: 'Light',    temperature: 31.0, windSpeed: 20, condition: 'Moderate Rain', alertLevel: 'Medium'   },
    { id: 'mp-mumbai',    name: 'Mumbai',      lat: 19.076, lng: 72.878, rainfall: 39.4, intensity: 'Heavy',    temperature: 27.0, windSpeed: 36, condition: 'Heavy Rain',    alertLevel: 'Critical' },
    { id: 'mp-pune',      name: 'Pune',        lat: 18.520, lng: 73.857, rainfall: 7.8,  intensity: 'Light',    temperature: 25.0, windSpeed: 13, condition: 'Light Rain',    alertLevel: 'None'     },
    { id: 'mp-nashik',    name: 'Nashik',      lat: 19.997, lng: 73.790, rainfall: 5.8,  intensity: 'Light',    temperature: 24.3, windSpeed: 10, condition: 'Cloudy',        alertLevel: 'None'     },
    { id: 'mp-bengaluru', name: 'Bengaluru',   lat: 12.972, lng: 77.595, rainfall: 2.5,  intensity: 'Light',    temperature: 22.2, windSpeed: 11, condition: 'Light Rain',    alertLevel: 'None'     },
    { id: 'mp-guwahati',  name: 'Guwahati',    lat: 26.144, lng: 91.736, rainfall: 42.0, intensity: 'Extreme',  temperature: 28.0, windSpeed: 35, condition: 'Thunderstorm',  alertLevel: 'High'     },
    { id: 'mp-kolkata',   name: 'Kolkata',     lat: 22.573, lng: 88.364, rainfall: 14.2, intensity: 'Moderate', temperature: 29.0, windSpeed: 21, condition: 'Moderate Rain', alertLevel: 'Low'      },
    { id: 'mp-chennai',   name: 'Chennai',     lat: 13.083, lng: 80.271, rainfall: 2.5,  intensity: 'Light',    temperature: 30.5, windSpeed: 13, condition: 'Light Rain',    alertLevel: 'None'     },
    { id: 'mp-hyderabad', name: 'Hyderabad',   lat: 17.387, lng: 78.491, rainfall: 9.8,  intensity: 'Light',    temperature: 27.2, windSpeed: 16, condition: 'Moderate Rain', alertLevel: 'None'     },
  ],
  120: [
    { id: 'mp-dehradun',  name: 'Dehradun',   lat: 30.316, lng: 78.032, rainfall: 14.8, intensity: 'Moderate', temperature: 22.5, windSpeed: 20, condition: 'Light Rain',    alertLevel: 'High'     },
    { id: 'mp-delhi',     name: 'Delhi',       lat: 28.614, lng: 77.209, rainfall: 3.0,  intensity: 'Light',    temperature: 30.0, windSpeed: 15, condition: 'Light Rain',    alertLevel: 'Medium'   },
    { id: 'mp-mumbai',    name: 'Mumbai',      lat: 19.076, lng: 72.878, rainfall: 18.5, intensity: 'Moderate', temperature: 26.6, windSpeed: 25, condition: 'Moderate Rain', alertLevel: 'Critical' },
    { id: 'mp-pune',      name: 'Pune',        lat: 18.520, lng: 73.857, rainfall: 3.0,  intensity: 'Light',    temperature: 24.6, windSpeed: 9,  condition: 'Cloudy',        alertLevel: 'None'     },
    { id: 'mp-nashik',    name: 'Nashik',      lat: 19.997, lng: 73.790, rainfall: 2.5,  intensity: 'None',     temperature: 24.0, windSpeed: 8,  condition: 'Partly Cloudy', alertLevel: 'None'     },
    { id: 'mp-bengaluru', name: 'Bengaluru',   lat: 12.972, lng: 77.595, rainfall: 0.5,  intensity: 'None',     temperature: 21.8, windSpeed: 9,  condition: 'Partly Cloudy', alertLevel: 'None'     },
    { id: 'mp-guwahati',  name: 'Guwahati',    lat: 26.144, lng: 91.736, rainfall: 20.0, intensity: 'Heavy',    temperature: 27.5, windSpeed: 24, condition: 'Heavy Rain',    alertLevel: 'High'     },
    { id: 'mp-kolkata',   name: 'Kolkata',     lat: 22.573, lng: 88.364, rainfall: 8.5,  intensity: 'Light',    temperature: 28.5, windSpeed: 16, condition: 'Light Rain',    alertLevel: 'Low'      },
    { id: 'mp-chennai',   name: 'Chennai',     lat: 13.083, lng: 80.271, rainfall: 1.0,  intensity: 'Light',    temperature: 30.0, windSpeed: 10, condition: 'Cloudy',        alertLevel: 'None'     },
    { id: 'mp-hyderabad', name: 'Hyderabad',   lat: 17.387, lng: 78.491, rainfall: 5.5,  intensity: 'Light',    temperature: 26.8, windSpeed: 12, condition: 'Light Rain',    alertLevel: 'None'     },
  ],
};

export const MAP_TIME_KEYS = [0, 30, 60, 120];
export function getMapDataForTime(minutes: number): WeatherMapPoint[] {
  const closest = MAP_TIME_KEYS.reduce((prev, curr) =>
    Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
  );
  return WEATHER_MAP_POINTS[closest] ?? WEATHER_MAP_POINTS[0];
}
