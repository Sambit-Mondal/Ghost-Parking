/**
 * Geographic calculation utilities for Ghost Parking.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const CHECK_IN_MAX_DISTANCE_METERS = 50;

/**
 * Calculates the great-circle distance between two points on the Earth
 * using the Haversine formula.
 *
 * @param coord1 First coordinate (e.g. device GPS)
 * @param coord2 Second coordinate (e.g. parking spot location)
 * @returns Distance in meters rounded to the nearest integer.
 */
export function calculateDistanceMeters(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  if (
    coord1.latitude === coord2.latitude &&
    coord1.longitude === coord2.longitude
  ) {
    return 0;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth's mean radius in meters

  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Checks if the device location is within the allowed check-in radius (default: 50 meters).
 *
 * @param deviceCoords Current GPS coordinates of the user's device
 * @param spotCoords Target GPS coordinates of the parking spot
 * @param maxDistanceMeters Maximum allowed distance in meters (defaults to 50m)
 * @returns Object with boolean isWithinRange and exact distance in meters.
 */
export function isWithinCheckInRadius(
  deviceCoords: Coordinates,
  spotCoords: Coordinates,
  maxDistanceMeters: number = CHECK_IN_MAX_DISTANCE_METERS
): { isWithinRange: boolean; distanceMeters: number } {
  const distanceMeters = calculateDistanceMeters(deviceCoords, spotCoords);
  return {
    isWithinRange: distanceMeters <= maxDistanceMeters,
    distanceMeters,
  };
}

/**
 * Generates an offset coordinate at an approximate distance in meters (useful for testing/simulation).
 * 1 degree latitude ~ 111,111 meters.
 */
export function createOffsetCoordinate(
  base: Coordinates,
  distanceMetersNorth: number,
  distanceMetersEast: number = 0
): Coordinates {
  const latOffset = distanceMetersNorth / 111111;
  const lonOffset =
    distanceMetersEast / (111111 * Math.cos((base.latitude * Math.PI) / 180));

  return {
    latitude: Number((base.latitude + latOffset).toFixed(6)),
    longitude: Number((base.longitude + lonOffset).toFixed(6)),
  };
}
