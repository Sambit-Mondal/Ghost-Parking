import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { HostReservationsScreen } from '../../src/screens/host/HostReservationsScreen';
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
          id: 'h_res_101',
          spot: { title: 'MG Road Metro Hub Parking (Bay A-12)' },
          driver: { name: 'Alex Rivera' },
          vehiclePlate: 'KA 03 MZ 4192',
          timeWindow: 'Today, 02:00 PM - 05:00 PM',
          total_amount: 240,
          status: 'active',
        },
        {
          id: 'h_res_102',
          spot: { title: 'Indiranagar 100ft Rd Garage (Bay C-04)' },
          driver: { name: 'Priya Sharma' },
          vehiclePlate: 'KA 01 EK 8810',
          timeWindow: 'Tomorrow, 10:00 AM - 12:00 PM',
          total_amount: 240,
          status: 'upcoming',
        },
        {
          id: 'h_res_103',
          spot: { title: 'MG Road Metro Hub Parking (Bay A-12)' },
          driver: { name: 'Rohan Gupta' },
          vehiclePlate: 'KA 05 AB 1234',
          timeWindow: 'Yesterday, 04:00 PM - 07:00 PM',
          total_amount: 240,
          status: 'completed',
        },
      ],
    })),
  };
});

describe('Component Test: HostReservationsScreen (Driver Bookings Portal)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderScreen = () =>
    render(
      <AuthProvider>
        <HostReservationsScreen />
      </AuthProvider>
    );

  it('renders header, filter pills, and default occupant reservations', async () => {
    const { getByText, getByTestId, findByTestId } = renderScreen();

    expect(getByText('Driver Bookings')).toBeTruthy();
    expect(getByText('Live occupant activity and payouts')).toBeTruthy();
    expect(getByTestId('host-res-all')).toBeTruthy();
    expect(getByTestId('host-res-active')).toBeTruthy();
    expect(getByTestId('host-res-completed')).toBeTruthy();

    expect(await findByTestId('host-res-card-h_res_101')).toBeTruthy();
    expect(getByTestId('host-res-card-h_res_102')).toBeTruthy();
    expect(getByTestId('host-res-card-h_res_103')).toBeTruthy();
  });

  it('filters reservations correctly between Active/Upcoming and Settled tabs', async () => {
    const { getByTestId, queryByTestId, findByTestId } = renderScreen();

    expect(await findByTestId('host-res-card-h_res_101')).toBeTruthy();

    // 1. Switch to 'Active / Upcoming' tab
    fireEvent.press(getByTestId('host-res-active'));
    expect(getByTestId('host-res-card-h_res_101')).toBeTruthy();
    expect(getByTestId('host-res-card-h_res_102')).toBeTruthy();
    expect(queryByTestId('host-res-card-h_res_103')).toBeNull(); // Completed/settled should be hidden

    // 2. Switch to 'Settled' tab
    fireEvent.press(getByTestId('host-res-completed'));
    expect(queryByTestId('host-res-card-h_res_101')).toBeNull();
    expect(queryByTestId('host-res-card-h_res_102')).toBeNull();
    expect(getByTestId('host-res-card-h_res_103')).toBeTruthy();

    // 3. Switch back to 'All'
    fireEvent.press(getByTestId('host-res-all'));
    expect(getByTestId('host-res-card-h_res_101')).toBeTruthy();
    expect(getByTestId('host-res-card-h_res_102')).toBeTruthy();
    expect(getByTestId('host-res-card-h_res_103')).toBeTruthy();
  });

  it('transitions existing reservation status in real time upon "booking_updated" event', async () => {
    const { getByTestId, findByText, findByTestId } = renderScreen();

    expect(await findByTestId('host-res-card-h_res_102')).toBeTruthy();

    // Initially h_res_102 is UPCOMING
    expect(await findByText('UPCOMING')).toBeTruthy();

    // Simulate backend WebSocket broadcast of booking transition to ACTIVE
    act(() => {
      __emitMockEvent('booking_updated', {
        id: 'h_res_102',
        spotTitle: 'Indiranagar 100ft Rd Garage (Bay C-04)',
        driverName: 'Priya Sharma',
        status: 'active',
        total_amount: 240,
      });
    });

    // Verify live notification banner appeared
    const liveBanner = await findByText(/is now ACTIVE/i);
    expect(liveBanner).toBeTruthy();
    expect(getByTestId('host-live-banner')).toBeTruthy();

    // Switch to Active filter: h_res_102 is now active
    fireEvent.press(getByTestId('host-res-active'));
    expect(getByTestId('host-res-card-h_res_102')).toBeTruthy();
  });

  it('dynamically prepends new incoming reservation on "booking_updated" event', async () => {
    const { findByTestId, findByText } = renderScreen();

    // Wait for initial load to finish before receiving real-time socket event
    expect(await findByTestId('host-res-card-h_res_101')).toBeTruthy();

    // Simulate a brand-new driver reservation arriving over WebSocket
    act(() => {
      __emitMockEvent('booking_updated', {
        id: 'h_res_new_999',
        spot: { title: 'Whitefield Cyber Spot' },
        driver: { name: 'Kavita Das' },
        vehiclePlate: 'KA 04 MP 7711',
        status: 'active',
        total_amount: 320,
      });
    });

    // Verify the new card is rendered in the host's list
    const newCard = await findByTestId('host-res-card-h_res_new_999');
    expect(newCard).toBeTruthy();
    expect(await findByText('Whitefield Cyber Spot')).toBeTruthy();
    expect(await findByText(/Kavita Das/)).toBeTruthy();
  });
});

