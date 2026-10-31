import { getApiBaseUrl } from '../config/api';
import { UserRole } from '../context/AuthContext';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'driver' | 'host';
  phone_number?: string;
  razorpay_account_id?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  role?: 'driver' | 'host';
}

export interface AuthApiResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone_number?: string | null;
    razorpay_account_id?: string | null;
    created_at?: string;
  };
  error?: string;
}

/**
 * Register a new user with Express API Gateway
 */
export async function registerApi(payload: RegisterPayload): Promise<AuthApiResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/register`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  if (typeof (timeoutId as any).unref === 'function') {
    (timeoutId as any).unref();
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-client': 'ghost-parking-mobile',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Registration failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      token: data.token,
      user: data.user,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Network timeout: Gateway did not respond in time',
      };
    }
    return {
      success: false,
      error: error.message || 'Network error connecting to API Gateway',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Login existing user with Express API Gateway
 */
export async function loginApi(payload: LoginPayload): Promise<AuthApiResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/login`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  if (typeof (timeoutId as any).unref === 'function') {
    (timeoutId as any).unref();
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-client': 'ghost-parking-mobile',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Login failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      token: data.token,
      user: data.user,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Network timeout: Gateway did not respond in time',
      };
    }
    return {
      success: false,
      error: error.message || 'Network error connecting to API Gateway',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch authenticated user profile using JWT token
 */
export async function getProfileApi(token: string): Promise<AuthApiResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/me`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'x-client': 'ghost-parking-mobile',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to fetch user profile',
      };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error fetching profile',
    };
  }
}

