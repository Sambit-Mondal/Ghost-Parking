import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { DriverBookingsScreen } from '../../src/screens/driver/DriverBookingsScreen';
import { AuthProvider } from '../../src/context/AuthContext';

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

  it('renders booking cards with "I have arrived" check-in button', () => {
    const { getByTestId, getAllByText } = renderScreen();

    expect(getByTestId('booking-card-res_live_772')).toBeTruthy();
    expect(getByTestId('check-in-btn-res_live_772')).toBeTruthy();
    expect(getAllByText('I have arrived (Check In)').length).toBeGreaterThan(0);
  });

  it('throws an error and rejects check-in if the user is further than 50 meters (120m)', async () => {
    const { getByTestId, findByText } = renderScreen();

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

    const { getByTestId, findByText } = renderScreen();

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

    const { getByTestId, findByText } = renderScreen();

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

    const { getByTestId, findByText } = renderScreen();

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
});
