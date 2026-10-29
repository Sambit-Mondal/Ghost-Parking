import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Returns the base URL for the Express Gateway API based on runtime environment.
 * Express Gateway acts as the single entry point on port 3000.
 */
export function getApiBaseUrl(): string {
  // 1. Explicit override via EXPO_PUBLIC_API_URL
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // 2. Global override for testing
  if (typeof (globalThis as any).__GHOST_API_URL__ === 'string') {
    return (globalThis as any).__GHOST_API_URL__;
  }

  // 3. Dynamic Host IP detection from Expo packager / debugger host
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;

    if (typeof hostUri === 'string' && hostUri.length > 0) {
      const host = hostUri.split(':')[0];
      const isTunnelHost =
        host.includes('ngrok') ||
        host.includes('exp.direct') ||
        host.includes('expo.dev');

      // If it's a real IP address on the local network (not a tunnel domain and not loopback)
      if (host && !isTunnelHost && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:3000`;
      }
    }
  } catch {
    // Ignore and fallback to platform defaults
  }

  // 4. Local network IP fallback for physical devices on Wi-Fi (192.168.0.147:3000)
  // On Android, check emulator vs physical device
  if (Platform.OS === 'android') {
    // Return laptop's Wi-Fi LAN address for physical phone connectivity
    return 'http://192.168.0.147:3000';
  }

  // 5. iOS Simulator, Desktop, and Web
  return 'http://localhost:3000';
}

export const API_BASE_URL = getApiBaseUrl();

export const API_ENDPOINTS = {
  // Proxied through Express Gateway -> Go Search Engine (/spots, /spots/nearby)
  SPOTS: '/api/spots',
  SPOTS_NEARBY: '/api/spots/nearby',
  SPOTS_SEARCH: '/api/spots/search',
  // Direct Express Gateway Endpoints
  SPOTS_DIRECT: '/spots',
  CHECK_IN: '/bookings/check-in',
  BOOKINGS: '/bookings',
  PAYMENTS: '/payments',
};
