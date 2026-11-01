import { getApiBaseUrl, API_ENDPOINTS } from '../config/api';

export interface CheckInRequest {
  bookingId: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  booking?: {
    id: string;
    status: string;
    checked_in_at?: string;
    [key: string]: any;
  };
  check_in_time?: string;
  distance_meters?: number;
  error?: string;
}

/**
 * Sends a check-in request to the Express API Gateway to activate a booking session.
 */
export async function checkInBooking(
  params: CheckInRequest
): Promise<CheckInResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${API_ENDPOINTS.CHECK_IN}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  if (typeof (timeoutId as any).unref === 'function') {
    (timeoutId as any).unref();
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        booking_id: params.bookingId,
        latitude: params.latitude,
        longitude: params.longitude,
        distance_meters: params.distanceMeters,
      }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.error || `Server responded with status ${response.status}`,
        error: data.error || 'Check-in failed',
      };
    }

    return {
      success: true,
      message: data.message || 'Check-in successful. Session activated.',
      booking: data.booking,
      check_in_time: data.check_in_time,
      distance_meters: data.distance_meters,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        message: 'Network request timed out. Please check your connection.',
        error: 'Timeout',
      };
    }

    return {
      success: false,
      message: error.message || 'Failed to connect to gateway',
      error: error.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches user-scoped bookings for either driver or host via GET /bookings/me
 */
export async function fetchMyBookings(
  token?: string | null
): Promise<{ success: boolean; bookings: any[]; role?: string; error?: string }> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/bookings/me`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-client': 'ghost-parking-mobile',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        bookings: [],
        error: data.error || `Failed to fetch bookings (${response.status})`,
      };
    }

    return {
      success: true,
      bookings: Array.isArray(data.bookings) ? data.bookings : [],
      role: data.role,
    };
  } catch (err: any) {
    return {
      success: false,
      bookings: [],
      error: err.message || 'Network request failed',
    };
  }
}
