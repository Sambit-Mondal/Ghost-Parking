import {
  calculateDistanceMeters,
  isWithinCheckInRadius,
  createOffsetCoordinate,
  CHECK_IN_MAX_DISTANCE_METERS,
} from '../../src/utils/geo';

describe('Geo Utilities - Distance & Check-in Radius', () => {
  const SPOT_COORDS = {
    latitude: 12.9716,
    longitude: 77.5946,
  };

  describe('calculateDistanceMeters', () => {
    it('returns 0 when two coordinates are identical', () => {
      const distance = calculateDistanceMeters(SPOT_COORDS, SPOT_COORDS);
      expect(distance).toBe(0);
    });

    it('calculates accurate distance between known Bangalore points', () => {
      // Trinity Metro to Indiranagar 100ft Rd (~5.06 km)
      const indiranagar = { latitude: 12.9784, longitude: 77.6408 };
      const distance = calculateDistanceMeters(SPOT_COORDS, indiranagar);
      expect(distance).toBeGreaterThan(4900);
      expect(distance).toBeLessThan(5200);
    });

    it('calculates accurate distance for very short distances (under 50m)', () => {
      // Offset by approx 30 meters north (30 / 111111 ~ 0.00027 deg)
      const nearbyPoint = {
        latitude: 12.9716 + 0.00027,
        longitude: 77.5946,
      };
      const distance = calculateDistanceMeters(SPOT_COORDS, nearbyPoint);
      expect(distance).toBeGreaterThanOrEqual(28);
      expect(distance).toBeLessThanOrEqual(32);
    });

    it('is symmetric (dist(A, B) === dist(B, A))', () => {
      const pointA = { latitude: 12.9716, longitude: 77.5946 };
      const pointB = { latitude: 12.9720, longitude: 77.5950 };
      expect(calculateDistanceMeters(pointA, pointB)).toBe(
        calculateDistanceMeters(pointB, pointA)
      );
    });
  });

  describe('isWithinCheckInRadius', () => {
    it('allows check-in when user is directly at the spot (0m)', () => {
      const result = isWithinCheckInRadius(SPOT_COORDS, SPOT_COORDS);
      expect(result.isWithinRange).toBe(true);
      expect(result.distanceMeters).toBe(0);
    });

    it('allows check-in when user is 25 meters away (< 50m)', () => {
      // 25 meters north
      const userCoords = createOffsetCoordinate(SPOT_COORDS, 25, 0);
      const result = isWithinCheckInRadius(userCoords, SPOT_COORDS);

      expect(result.isWithinRange).toBe(true);
      expect(result.distanceMeters).toBeLessThanOrEqual(CHECK_IN_MAX_DISTANCE_METERS);
    });

    it('allows check-in when user is exactly on the 50m boundary', () => {
      const userCoords = createOffsetCoordinate(SPOT_COORDS, 50, 0);
      const result = isWithinCheckInRadius(userCoords, SPOT_COORDS, 50);

      expect(result.distanceMeters).toBe(50);
      expect(result.isWithinRange).toBe(true);
    });

    it('rejects check-in when user is further than 50 meters (e.g. 85m)', () => {
      const userCoords = createOffsetCoordinate(SPOT_COORDS, 85, 0);
      const result = isWithinCheckInRadius(userCoords, SPOT_COORDS);

      expect(result.isWithinRange).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(50);
    });

    it('rejects check-in when user is far away (e.g. 500m)', () => {
      const userCoords = createOffsetCoordinate(SPOT_COORDS, 500, 0);
      const result = isWithinCheckInRadius(userCoords, SPOT_COORDS);

      expect(result.isWithinRange).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(450);
    });
  });
});
