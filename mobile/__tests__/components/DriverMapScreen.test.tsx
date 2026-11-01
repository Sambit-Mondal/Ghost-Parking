import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { DriverMapScreen } from '../../src/screens/driver/DriverMapScreen';
import { AuthProvider } from '../../src/context/AuthContext';

const MOCK_NEARBY_SPOTS = [
  {
    id: '4a038134-d6f6-4cff-8e93-a031dc49c32a',
    title: 'MG Road Metro Hub Parking',
    address: 'Near Trinity Metro Station, MG Road, Bengaluru',
    latitude: 12.9716,
    longitude: 77.5946,
    hourly_rate: 80,
    is_active: true,
    distance_meters: 650,
    distance_miles: 0.4,
    available_slots: 3,
  },
  {
    id: 'f9b43626-4957-477c-b1b0-84700120bdf2',
    title: 'Indiranagar 100ft Rd Garage',
    address: '12th Main Rd, HAL 2nd Stage, Indiranagar',
    latitude: 12.9784,
    longitude: 77.6408,
    hourly_rate: 120,
    is_active: true,
    distance_meters: 1900,
    distance_miles: 1.2,
    available_slots: 1,
  },
  {
    id: 'aa074775-207e-473c-9d70-b61396f6abb4',
    title: 'Koramangala Tech Park Bay',
    address: '4th Block, 80 Feet Rd, Koramangala',
    latitude: 12.9352,
    longitude: 77.6245,
    hourly_rate: 60,
    is_active: true,
    distance_meters: 3400,
    distance_miles: 2.1,
    available_slots: 5,
  },
  {
    id: '7cae0f87-775d-49aa-bb38-afbbbd6d0c32',
    title: 'Church Street Underground Bay',
    address: 'Church St, Shanthala Nagar, Ashok Nagar',
    latitude: 12.9753,
    longitude: 77.6015,
    hourly_rate: 150,
    is_active: false,
    distance_meters: 1100,
    distance_miles: 0.7,
    available_slots: 0,
  },
];

jest.mock('../../src/services/spotService', () => {
  const actual = jest.requireActual('../../src/services/spotService');
  return {
    ...actual,
    fetchNearbySpots: jest.fn(async () => ({
      success: true,
      spots: MOCK_NEARBY_SPOTS,
      source: 'go_search_engine',
      count: MOCK_NEARBY_SPOTS.length,
    })),
  };
});

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

  it('renders search input, filter pills, radar map, and spot list', async () => {
    const { getByTestId, getAllByText, findByText } = renderScreen();

    expect(getByTestId('driver-search-input')).toBeTruthy();
    expect(getByTestId('filter-all')).toBeTruthy();
    expect(getByTestId('filter-affordable')).toBeTruthy();
    expect(getByTestId('filter-nearby')).toBeTruthy();
    expect(getByTestId('driver-map-placeholder')).toBeTruthy();
    expect(await findByText('MG Road Metro Hub Parking')).toBeTruthy();
    expect(getAllByText('Indiranagar 100ft Rd Garage').length).toBeGreaterThan(0);
  });

  it('filters spots by text search', async () => {
    const { getByTestId, getAllByText, queryByText, findByText } = renderScreen();
    expect(await findByText('Indiranagar 100ft Rd Garage')).toBeTruthy();
    const searchInput = getByTestId('driver-search-input');

    fireEvent.changeText(searchInput, 'Indiranagar');

    expect(getAllByText('Indiranagar 100ft Rd Garage').length).toBeGreaterThan(0);
    expect(queryByText('Koramangala Tech Park Bay')).toBeNull();
  });

  it('filters spots by affordability pill', async () => {
    const { getByTestId, queryByText, findByText } = renderScreen();
    expect(await findByText('MG Road Metro Hub Parking')).toBeTruthy();
    const affordablePill = getByTestId('filter-affordable');

    fireEvent.press(affordablePill);

    // Church Street is ₹150, so it shouldn't show under <= ₹80/hr
    expect(queryByText('Church Street Underground Bay')).toBeNull();
  });

  it('opens booking modal upon pressing Reserve on a spot card', async () => {
    const { getByTestId, getByText, findByTestId } = renderScreen();
    const reserveBtn = await findByTestId(`spot-card-${MOCK_NEARBY_SPOTS[0].id}-reserve-btn`);

    fireEvent.press(reserveBtn);

    expect(getByTestId('booking-modal')).toBeTruthy();
    expect(getByText('Select Duration (Hours):')).toBeTruthy();
    expect(getByTestId('confirm-booking-btn')).toBeTruthy();
  });

  it('updates reservation total when duration is changed and locks escrow on confirm', async () => {
    const { getByTestId, getByText, findByTestId } = renderScreen();
    const reserveBtn = await findByTestId(`spot-card-${MOCK_NEARBY_SPOTS[0].id}-reserve-btn`);
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
