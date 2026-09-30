// ============================================================
// WeatherNow AI — Fast & Resilient Reverse Geocoding Utility
// Resolves arbitrary (lat, lng) clicks into human-readable locations
// Features: In-memory LRU-style cache, dual-provider fallback, timeout & abort support
// ============================================================

import { LOCATIONS } from '../constants';

export interface GeocodeResult {
  name: string;
  state: string;
}

// In-memory cache keyed by rounded coordinates (3 decimal places ~= 110m precision)
const geocodeCache = new Map<string, GeocodeResult>();

// Maximum cache entries to prevent memory growth
const MAX_CACHE_ENTRIES = 200;

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Approximate geographic region / nearest station heuristic when APIs are offline or unreachable
 */
function getOfflineLocationEstimate(lat: number, lng: number): GeocodeResult {
  // 1. Check if clicking very close to a known station (< 35 km)
  let nearestStation: (typeof LOCATIONS)[0] | null = null;
  let minDistance = Infinity;

  for (const station of LOCATIONS) {
    const dLat = (station.lat - lat) * 111.0;
    const dLng = (station.lng - lng) * 111.0 * Math.cos((lat * Math.PI) / 180);
    const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
    if (distKm < minDistance) {
      minDistance = distKm;
      nearestStation = station;
    }
  }

  if (nearestStation && minDistance <= 35) {
    return {
      name: `Near ${nearestStation.name}`,
      state: nearestStation.state,
    };
  }

  // 2. Maritime checks in domain
  if (lat < 23 && lng < 72.5) {
    return { name: 'Arabian Sea', state: 'Offshore Maritime Basin' };
  }
  if (lat < 22 && lng > 83.5) {
    return { name: 'Bay of Bengal', state: 'Offshore Maritime Basin' };
  }
  if (lat < 10) {
    return { name: 'Indian Ocean', state: 'Equatorial Oceanic Waters' };
  }

  // 3. Subcontinental regional bounds
  if (lat > 30.5) {
    return { name: 'Himalayan Region', state: 'Northern Mountain Sector' };
  }

  return {
    name: 'Unnamed Location',
    state: 'Custom Map Point',
  };
}

/**
 * Reverse-geocodes latitude and longitude into human-readable place name and administrative state.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<GeocodeResult> {
  const cacheKey = getCacheKey(lat, lng);

  // 1. Check in-memory cache
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // 2. Try Primary Provider: OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    const handleAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', handleAbort);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&zoom=12&addressdetails=1`;

    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', handleAbort);

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};

      // Determine most specific, meaningful locality name
      const localName =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.suburb ||
        addr.municipality ||
        addr.county ||
        addr.state_district ||
        addr.district ||
        data.name;

      const stateName = addr.state || addr.region || addr.country || 'Custom Point';

      if (localName) {
        const result: GeocodeResult = {
          name: localName,
          state: stateName,
        };

        if (geocodeCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = geocodeCache.keys().next().value;
          if (oldestKey) geocodeCache.delete(oldestKey);
        }
        geocodeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError' && signal?.aborted) {
      throw err; // Cancelled because a new location was selected
    }
    // Otherwise continue to secondary provider
  }

  // 3. Try Secondary Provider: BigDataCloud Client API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const handleAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', handleAbort);

    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}&localityLanguage=en`;

    const response = await fetch(bdcUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', handleAbort);

    if (response.ok) {
      const data = await response.json();
      const localName =
        data.locality ||
        data.city ||
        data.localityInfo?.administrative?.[3]?.name ||
        data.localityInfo?.administrative?.[2]?.name ||
        data.localityInfo?.administrative?.[1]?.name;

      const stateName =
        data.principalSubdivision ||
        data.countryName ||
        'Custom Point';

      if (localName) {
        const result: GeocodeResult = {
          name: localName,
          state: stateName,
        };

        if (geocodeCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = geocodeCache.keys().next().value;
          if (oldestKey) geocodeCache.delete(oldestKey);
        }
        geocodeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
  }

  // 4. Graceful Fallback: Estimate from Indian Subcontinent Geography
  const fallbackResult = getOfflineLocationEstimate(lat, lng);
  geocodeCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}
