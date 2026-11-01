import { normalizeSpot, fetchNearbySpots, fetchMySpots } from '../../src/services/spotService';

describe('Unit Test: spotService', () => {
  const originalFetch = (globalThis as any).fetch;

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('normalizeSpot', () => {
    it('correctly normalizes a spot returned from Go Search Engine format (nested location object)', () => {
      const rawGoSpot = {
        id: 'spot-go-1',
        title: 'Brigade Road PostGIS Spot',
        address: 'MG Road, Bangalore',
        location: {
          latitude: 12.9745,
          longitude: 77.6085,
        },
        hourly_rate: 100,
        is_active: true,
        distance_meters: 850.5,
        distance_miles: 0.53,
        available_slots: 4,
      };

      const normalized = normalizeSpot(rawGoSpot);

      expect(normalized.id).toBe('spot-go-1');
      expect(normalized.title).toBe('Brigade Road PostGIS Spot');
      expect(normalized.latitude).toBe(12.9745);
      expect(normalized.longitude).toBe(77.6085);
      expect(normalized.hourly_rate).toBe(100);
      expect(normalized.distance_meters).toBe(851);
      expect(normalized.distance_miles).toBe(0.53);
      expect(normalized.available_slots).toBe(4);
    });

    it('correctly normalizes a spot returned from Express Prisma format (flat coordinates)', () => {
      const rawExpressSpot = {
        id: 'spot-express-1',
        title: 'Commercial St Garage',
        address: 'Shivajinagar, Bangalore',
        latitude: 12.9818,
        longitude: 77.6078,
        hourly_rate: '75',
        is_active: true,
        distance_meters: 1609.34,
      };

      const normalized = normalizeSpot(rawExpressSpot);

      expect(normalized.id).toBe('spot-express-1');
      expect(normalized.title).toBe('Commercial St Garage');
      expect(normalized.latitude).toBe(12.9818);
      expect(normalized.longitude).toBe(77.6078);
      expect(normalized.hourly_rate).toBe(75);
      expect(normalized.distance_miles).toBe(1); // 1609.34m / 1609.34 = 1.00 mi
      expect(normalized.available_slots).toBe(3); // default fallback
    });

    it('safely handles missing or invalid coordinates with defaults', () => {
      const invalidSpot = {
        id: 999,
        title: null,
      };

      const normalized = normalizeSpot(invalidSpot);

      expect(normalized.id).toBe('999');
      expect(normalized.title).toBe('Parking Spot');
      expect(normalized.latitude).toBe(12.9716);
      expect(normalized.longitude).toBe(77.5946);
      expect(normalized.hourly_rate).toBe(80);
    });
  });

  describe('fetchNearbySpots', () => {
    it('returns Go search engine spots when Express gateway proxy responds 200', async () => {
      const mockSpots = [
        {
          id: 'spot-go-1',
          title: 'Residency Rd Spot',
          address: 'Residency Rd, Bangalore',
          location: { latitude: 12.9701, longitude: 77.6012 },
          hourly_rate: 90,
          is_active: true,
          distance_meters: 400,
        },
      ];

      (globalThis as any).fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          query: { latitude: 12.9716, longitude: 77.5946, radius_miles: 5 },
          count: 1,
          spots: mockSpots,
        }),
      } as any);

      const result = await fetchNearbySpots({
        latitude: 12.9716,
        longitude: 77.5946,
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('go_search_engine');
      expect(result.count).toBe(1);
      expect(result.spots[0].title).toBe('Residency Rd Spot');
      expect(result.spots[0].latitude).toBe(12.9701);
    });

    it('falls back to Express direct /spots when Go proxy returns 502 Bad Gateway', async () => {
      const mockExpressFallbackSpots = [
        {
          id: 'spot-fallback-1',
          title: 'Direct Express DB Spot',
          address: 'Richmond Town, Bangalore',
          latitude: 12.964,
          longitude: 77.603,
          hourly_rate: 70,
        },
      ];

      // 1st call to Go proxy fails with 502
      // 2nd call to direct Express succeeds with 200
      (globalThis as any).fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({ error: 'Bad Gateway' }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            spots: mockExpressFallbackSpots,
          }),
        } as any);

      const result = await fetchNearbySpots({
        latitude: 12.9716,
        longitude: 77.5946,
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('express_direct');
      expect(result.count).toBe(1);
      expect(result.spots[0].title).toBe('Direct Express DB Spot');
    });

    it('gracefully handles complete network failure without crashing', async () => {
      (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

      const result = await fetchNearbySpots({
        latitude: 12.9716,
        longitude: 77.5946,
      });

      expect(result.success).toBe(false);
      expect(result.source).toBe('fallback_cache');
      expect(result.spots).toEqual([]);
    });
  });

  describe('fetchMySpots', () => {
    it('fetches host-scoped spots from GET /spots/me with Bearer token', async () => {
      const mockHostSpots = [
        {
          id: 'spot-host-uuid-1',
          title: 'My Covered Driveway',
          address: 'Koramangala, Bangalore',
          hourly_rate: 90,
          is_active: true,
          total_bookings: 5,
          lifetime_earnings: 1200,
        },
      ];

      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ count: 1, spots: mockHostSpots }),
      } as any);

      const res = await fetchMySpots('mock-host-jwt-token');
      expect(res.success).toBe(true);
      expect(res.spots.length).toBe(1);
      expect(res.spots[0].title).toBe('My Covered Driveway');

      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        expect.stringContaining('/spots/me'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-host-jwt-token',
          }),
        })
      );
    });

    it('returns error when server responds with 401 unauthenticated', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Access denied. No authentication token provided.' }),
      } as any);

      const res = await fetchMySpots(null);
      expect(res.success).toBe(false);
      expect(res.spots).toEqual([]);
      expect(res.error).toContain('Access denied');
    });
  });
});
