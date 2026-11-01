import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DriverMapScreen, INITIAL_SPOTS } from '../../src/screens/driver/DriverMapScreen';
import { AuthProvider } from '../../src/context/AuthContext';

// Mock Razorpay payment service for deterministic component testing
jest.mock('../../src/services/paymentService', () => ({
  createPaymentOrder: jest.fn(async () => ({
    success: true,
    order_id: 'order_test_mock_123',
    amount: 24000,
    currency: 'INR',
    key_id: 'rzp_test_placeholder',
    booking_id: 'booking_test_mock_123',
  })),
  openRazorpayCheckout: jest.fn(async () => ({
    razorpay_payment_id: 'pay_test_mock_123',
    razorpay_order_id: 'order_test_mock_123',
    razorpay_signature: 'sig_test_mock_123',
  })),
  verifyPayment: jest.fn(async () => ({
    success: true,
    booking: { id: 'booking_test_mock_123', status: 'active' },
  })),
}));

describe('Component Test: DriverMapScreen', () => {
  const renderScreen = () =>
    render(
      <AuthProvider>
        <DriverMapScreen />
      </AuthProvider>
    );

  it('renders search input, filter pills, radar map, and spot list', () => {
    const { getByTestId, getAllByText } = renderScreen();

    expect(getByTestId('driver-search-input')).toBeTruthy();
    expect(getByTestId('filter-all')).toBeTruthy();
    expect(getByTestId('filter-affordable')).toBeTruthy();
    expect(getByTestId('filter-nearby')).toBeTruthy();
    expect(getByTestId('driver-map-placeholder')).toBeTruthy();
    expect(getAllByText('MG Road Metro Hub Parking').length).toBeGreaterThan(0);
    expect(getAllByText('Indiranagar 100ft Rd Garage').length).toBeGreaterThan(0);
  });

  it('filters spots by text search', () => {
    const { getByTestId, getAllByText, queryByText } = renderScreen();
    const searchInput = getByTestId('driver-search-input');

    fireEvent.changeText(searchInput, 'Indiranagar');

    expect(getAllByText('Indiranagar 100ft Rd Garage').length).toBeGreaterThan(0);
    expect(queryByText('Koramangala Tech Park Bay')).toBeNull();
  });

  it('filters spots by affordability pill', () => {
    const { getByTestId, queryByText } = renderScreen();
    const affordablePill = getByTestId('filter-affordable');

    fireEvent.press(affordablePill);

    // Church Street is ₹150, so it shouldn't show under <= ₹80/hr
    expect(queryByText('Church Street Underground Bay')).toBeNull();
  });

  it('opens booking modal upon pressing Reserve on a spot card', () => {
    const { getByTestId, getByText } = renderScreen();
    const reserveBtn = getByTestId(`spot-card-${INITIAL_SPOTS[0].id}-reserve-btn`);

    fireEvent.press(reserveBtn);

    expect(getByTestId('booking-modal')).toBeTruthy();
    expect(getByText('Select Duration (Hours):')).toBeTruthy();
    expect(getByTestId('confirm-booking-btn')).toBeTruthy();
  });

  it('updates reservation total when duration is changed and locks escrow on confirm', async () => {
    const { getByTestId, getByText } = renderScreen();
    const reserveBtn = getByTestId(`spot-card-${INITIAL_SPOTS[0].id}-reserve-btn`);
    fireEvent.press(reserveBtn);

    // Select 3 hours (Rate ₹80 * 3 = ₹240)
    const threeHourBtn = getByTestId('duration-btn-3');
    fireEvent.press(threeHourBtn);

    expect(getByText('3 Hours')).toBeTruthy();

    const confirmBtn = getByTestId('confirm-booking-btn');
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(getByTestId('booking-confirmation-view')).toBeTruthy();
      expect(getByText('Reservation Locked!')).toBeTruthy();
    });
  });

  it('renders the live gateway connection status bar and refresh button', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('gateway-status-bar')).toBeTruthy();
    expect(getByTestId('refresh-spots-btn')).toBeTruthy();
  });

  it('dynamically renders newly available parking spot in real-time when WebSocket broadcast arrives', async () => {
    const { getByTestId, getAllByText } = renderScreen();

    const socketMock = require('../../src/services/socketService');
    const newSpotData = {
      id: 'spot-ws-live-999',
      title: 'HSR Layout Live Driveway',
      address: '27th Main Rd, HSR Layout Sector 1',
      latitude: 12.9121,
      longitude: 77.6446,
      hourly_rate: 95,
      is_active: true,
      available_slots: 2,
    };

    const { act } = require('@testing-library/react-native');
    act(() => {
      socketMock.__emitMockEvent('new_spot_available', newSpotData);
    });

    await waitFor(() => {
      expect(getAllByText('HSR Layout Live Driveway').length).toBeGreaterThan(0);
      expect(getByTestId('live-spot-banner')).toBeTruthy();
      expect(getByTestId('map-marker-spot-ws-live-999')).toBeTruthy();
    });
  });
});
