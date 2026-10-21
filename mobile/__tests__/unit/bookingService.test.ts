import { checkInBooking } from '../../src/services/bookingService';

// Mock global fetch
const originalFetch = (globalThis as any).fetch;

describe('Booking Service - Check-in API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('sends POST request to /bookings/check-in with correct payload and returns success', async () => {
    const mockResponse = {
      message: 'Check-in successful. Parking session activated.',
      booking: {
        id: 'res_live_772',
        status: 'active',
        checked_in_at: '2026-10-20T19:50:00Z',
      },
      check_in_time: '2026-10-20T19:50:00Z',
      distance_meters: 15,
    };

    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await checkInBooking({
      bookingId: 'res_live_772',
      latitude: 12.9716,
      longitude: 77.5946,
      distanceMeters: 15,
    });

    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/bookings/check-in'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          booking_id: 'res_live_772',
          latitude: 12.9716,
          longitude: 77.5946,
          distance_meters: 15,
        }),
      })
    );

    expect(result.success).toBe(true);
    expect(result.booking?.status).toBe('active');
    expect(result.distance_meters).toBe(15);
  });

  it('handles server error response cleanly', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Cannot check in to a booking that is already completed',
      }),
    });

    const result = await checkInBooking({
      bookingId: 'res_past_904',
      latitude: 12.9716,
      longitude: 77.5946,
      distanceMeters: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Cannot check in to a booking that is already completed'
    );
  });

  it('handles network failure gracefully', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    const result = await checkInBooking({
      bookingId: 'res_live_772',
      latitude: 12.9716,
      longitude: 77.5946,
      distanceMeters: 20,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network request failed');
  });
});
