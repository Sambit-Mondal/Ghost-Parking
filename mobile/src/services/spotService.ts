import { getApiBaseUrl, API_ENDPOINTS } from '../config/api';
import { ParkingSpotData } from '../components/driver/SpotCard';

export interface FetchNearbySpotsParams {
  latitude: number;
  longitude: number;
  limit?: number;
}

export interface SpotsApiResponse {
  success: boolean;
  spots: ParkingSpotData[];
  source: 'go_search_engine' | 'express_direct' | 'fallback_cache';
  count: number;
  error?: string;
}

/**
 * Normalizes raw spot JSON from Go Search Engine or Express Prisma to ParkingSpotData.
 */
export function normalizeSpot(raw: any): ParkingSpotData {
  const latitude =
    typeof raw.location?.latitude === 'number'
      ? raw.location.latitude
      : typeof raw.latitude === 'number'
      ? raw.latitude
      : parseFloat(raw.latitude || raw.location?.latitude || '12.9716');

  const longitude =
    typeof raw.location?.longitude === 'number'
      ? raw.location.longitude
      : typeof raw.longitude === 'number'
      ? raw.longitude
      : parseFloat(raw.longitude || raw.location?.longitude || '77.5946');

  const distanceMeters =
    typeof raw.distance_meters === 'number'
      ? Math.round(raw.distance_meters)
      : undefined;

  const distanceMiles =
    typeof raw.distance_miles === 'number'
      ? Number(raw.distance_miles.toFixed(2))
      : distanceMeters !== undefined
      ? Number((distanceMeters / 1609.34).toFixed(2))
      : undefined;

  return {
    id: String(raw.id),
    title: raw.title || 'Parking Spot',
    address: raw.address || 'Bengaluru, Karnataka',
    latitude: isNaN(latitude) ? 12.9716 : latitude,
    longitude: isNaN(longitude) ? 77.5946 : longitude,
    hourly_rate: Number(raw.hourly_rate) || 80,
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
    distance_meters: distanceMeters,
    distance_miles: distanceMiles,
    available_slots: typeof raw.available_slots === 'number' ? raw.available_slots : 3,
  };
}

/**
 * Fetches nearby parking spots from the Express Gateway (/api/spots/nearby),
 * which forwards the request to the Go Search Engine service.
 */
export async function fetchNearbySpots(
  params: FetchNearbySpotsParams
): Promise<SpotsApiResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${API_ENDPOINTS.SPOTS_NEARBY}?latitude=${params.latitude}&longitude=${params.longitude}&limit=${params.limit || 50}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  if (typeof (timeoutId as any).unref === 'function') {
    (timeoutId as any).unref();
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-client': 'ghost-parking-mobile',
      },
      signal: controller.signal,
    });

    if (response.ok) {
      const data = await response.json();
      const rawList = Array.isArray(data.spots) ? data.spots : [];
      const spots = rawList.map(normalizeSpot);

      return {
        success: true,
        spots,
        count: spots.length,
        source: 'go_search_engine',
      };
    }

    // If proxy to Go returns 502/bad gateway, fallback to direct Express /spots
    if (response.status === 502 || response.status === 503) {
      return await fetchDirectSpotsFallback(baseUrl);
    }

    return {
      success: false,
      spots: [],
      count: 0,
      source: 'go_search_engine',
      error: `Gateway returned status ${response.status}`,
    };
  } catch (error: any) {
    // On network failure or timeout, attempt direct Express endpoint
    try {
      return await fetchDirectSpotsFallback(baseUrl);
    } catch {
      return {
        success: false,
        spots: [],
        count: 0,
        source: 'fallback_cache',
        error: error.message || 'Failed to connect to API Gateway',
      };
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fallback to direct Express /spots (Prisma PostgreSQL) if Go service is booting up.
 */
async function fetchDirectSpotsFallback(baseUrl: string): Promise<SpotsApiResponse> {
  const directUrl = `${baseUrl}${API_ENDPOINTS.SPOTS_DIRECT}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  if (typeof (timeoutId as any).unref === 'function') {
    (timeoutId as any).unref();
  }

  try {
    const res = await fetch(directUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data.spots) ? data.spots : [];
      const spots = rawList.map(normalizeSpot);
      return {
        success: true,
        spots,
        count: spots.length,
        source: 'express_direct',
      };
    }
  } catch {
    // Ignore fallback errors
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    success: false,
    spots: [],
    count: 0,
    source: 'fallback_cache',
    error: 'All backend gateway endpoints unavailable',
  };
}
