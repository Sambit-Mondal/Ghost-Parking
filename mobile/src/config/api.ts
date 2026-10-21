import { Platform } from 'react-native';

/**
 * Returns the base URL for the Express Gateway API based on runtime environment.
 */
export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // Android emulator uses 10.0.2.2 to access host machine localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  // iOS simulator, macOS, and web
  return 'http://localhost:3000';
}

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  CHECK_IN: '/bookings/check-in',
  BOOKINGS: '/bookings',
  SPOTS: '/spots',
  PAYMENTS: '/payments',
};
