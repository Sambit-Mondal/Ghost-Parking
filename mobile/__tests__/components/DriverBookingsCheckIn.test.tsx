import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { DriverBookingsScreen } from '../../src/screens/driver/DriverBookingsScreen';
import { AuthProvider } from '../../src/context/AuthContext';

// Import mocked socketService to trigger simulated WebSocket broadcasts
const { __emitMockEvent } = require('../../src/services/socketService');

jest.mock('../../src/services/bookingService', () => {
  const actual = jest.requireActual('../../src/services/bookingService');
  return {
    ...actual,
    fetchMyBookings: jest.fn(async () => ({
      success: true,
      bookings: [
        {
          id: 'res_live_772',
          spot: {
            title: 'MG Road Metro Hub Parking',
            address: 'Near Trinity Metro Station, MG Road, Bengaluru',
            latitude: 12.9716,
            longitude: 77.5946,
          },
          startTime: 'Today, 02:00 PM',
          endTime: 'Today, 05:00 PM',
          durationHours: 3,
          total_amount: 240,
          status: 'upcoming',
          spotNumber: 'Bay A-12',
        },
      ],
    })),
  };
});

// Spy on Alert.alert
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('Component Test: Driver Check-In Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderScreen = () =>
    render(
      <AuthProvider>
        <DriverBookingsScreen />
      </AuthProvider>
    );

  it('renders booking cards with "I have arrived" check-in button', async () => {
    const { getByTestId, getAllByText, findByTestId } = renderScreen();

    expect(await findByTestId('booking-card-res_live_772')).toBeTruthy();
    expect(getByTestId('check-in-btn-res_live_772')).toBeTruthy();
    expect(getAllByText('I have arrived (Check In)').length).toBeGreaterThan(0);
  });

  it('throws an error and rejects check-in if the user is further than 50 meters (120m)', async () => {
    const { getByTestId, findByText, findByTestId } = renderScreen();

    expect(await findByTestId('booking-card-res_live_772')).toBeTruthy();

    // Trigger simulation chip for 120m away (> 50m)
    const farBtn = getByTestId('simulate-far-res_live_772');
    fireEvent.press(farBtn);

    // Expect error feedback on the card
    const errorMsg = await findByText(/You are 120m away from the spot/i);
    expect(errorMsg).toBeTruthy();

    expect(alertSpy).toHaveBeenCalledWith(
      'Check-In Failed: Too Far',
      expect.stringContaining('You are currently 120 meters away')
    );
  });

  it('successfully activates session via gateway check-in when user is within 50 meters (18m)', async () => {
    // Mock successful check-in API response
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Check-in successful. Parking session activated.',
        booking: {
          id: 'res_live_772',
          status: 'active',
          checked_in_at: new Date().toISOString(),
        },
        check_in_time: new Date().toISOString(),
        distance_meters: 18,
      }),
    });

    const { getByTestId, findByText, findByTestId } = renderScreen();

    expect(await findByTestId('booking-card-res_live_772')).toBeTruthy();

    // Trigger simulation chip for 18m away (<= 50m)
    const arrivedBtn = getByTestId('simulate-arrived-res_live_772');
    fireEvent.press(arrivedBtn);

    // Expect success feedback banner
    const successMsg = await findByText(/Session Activated! Verified within 18m of spot/i);
    expect(successMsg).toBeTruthy();

    // Expect alert confirmation
    expect(alertSpy).toHaveBeenCalledWith(
      'Check-In Successful! 🅿️',
      expect.stringContaining('GPS verified (18m away)')
    );

    // Expect check-in badge and distance on card
    expect(await findByText('CHECKED IN')).toBeTruthy();
    expect(await findByText(/18m from bay/i)).toBeTruthy();
  });

  it('uses Expo Location to check in when live GPS is within 50 meters of the spot', async () => {
    // MG Road coordinates: 12.9716, 77.5946
    // Mock device location 15 meters north (15 / 111111 ~ 0.000135)
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });

    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: 12.9716 + 0.000135,
        longitude: 77.5946,
        altitude: 920,
        accuracy: 5,
        altitudeAccuracy: 5,
        heading: 0,
        speed: 0,
      },
      timestamp: Date.now(),
    });

    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Check-in successful. Parking session activated.',
        booking: {
          id: 'res_live_772',
          status: 'active',
          checked_in_at: new Date().toISOString(),
        },
        check_in_time: new Date().toISOString(),
        distance_meters: 15,
      }),
    });

    const { getByTestId, findByText, findByTestId } = renderScreen();

    expect(await findByTestId('booking-card-res_live_772')).toBeTruthy();

    // Tap live "I have arrived" button
    const checkInBtn = getByTestId('check-in-btn-res_live_772');
    fireEvent.press(checkInBtn);

    await waitFor(() => {
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
    });

    // Expect successful session activation
    expect(await findByText(/Session Activated! Verified within 15m of spot/i)).toBeTruthy();
  });

  it('displays an error alert if location permission is denied by user', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
      granted: false,
    });

    const { getByTestId, findByText, findByTestId } = renderScreen();

    expect(await findByTestId('booking-card-res_live_772')).toBeTruthy();

    const checkInBtn = getByTestId('check-in-btn-res_live_772');
    fireEvent.press(checkInBtn);

    await waitFor(() => {
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    expect(
      await findByText(/Location permission is required to verify you have arrived/i)
    ).toBeTruthy();

    expect(alertSpy).toHaveBeenCalledWith(
      'Permission Denied',
      expect.stringContaining('Location permission is required')
    );
  });

  it('updates reservation card in real time when "booking_updated" socket event is received', async () => {
    const { findByText, getByTestId, findByTestId } = renderScreen();

    // Wait for initial load to finish before receiving real-time socket event
    expect(await findByTestId('booking-card-res_live_772')).toBeTruthy();

    // Simulate backend payment clearing / host check-in socket broadcast
    act(() => {
      __emitMockEvent('booking_updated', {
        id: 'res_up_381',
        spotTitle: 'Indiranagar 100ft Rd Garage',
        status: 'active',
        total_amount: 240,
      });
    });

    // Verify notification banner appears
    expect(await findByText(/Reservation res_up_3 status: ACTIVE/i)).toBeTruthy();
    expect(getByTestId('driver-live-banner')).toBeTruthy();
  });

  it('dynamically prepends new incoming reservation on "booking_updated" socket event', async () => {
    const { findByTestId, findByText } = renderScreen();

    // Wait for initial load to finish before receiving real-time socket event
    expect(await findByTestId('booking-card-res_live_772')).toBeTruthy();

    // Simulate newly created booking via Razorpay checkout
    act(() => {
      __emitMockEvent('booking_updated', {
        id: 'res_driver_realtime_888',
        spotTitle: 'Church Street Underground Bay',
        address: 'Church St, Shanthala Nagar, Ashok Nagar',
        status: 'active',
        total_amount: 300,
        spotNumber: 'Bay D-19',
      });
    });

    const newCard = await findByTestId('booking-card-res_driver_realtime_888');
    expect(newCard).toBeTruthy();
    expect(await findByText('Church Street Underground Bay')).toBeTruthy();
  });
});
