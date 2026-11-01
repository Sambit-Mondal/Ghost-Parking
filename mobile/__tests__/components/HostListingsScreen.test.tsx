import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { HostListingsScreen } from '../../src/screens/host/HostListingsScreen';
import { AuthProvider } from '../../src/context/AuthContext';
import * as Location from 'expo-location';

describe('Component Test: HostListingsScreen', () => {
  const renderScreen = () =>
    render(
      <AuthProvider>
        <HostListingsScreen />
      </AuthProvider>
    );

  it('renders host earnings KPIs, connected Razorpay badge, and spot cards', () => {
    const { getByTestId, getByText } = renderScreen();

    expect(getByTestId('host-kpi-earnings')).toBeTruthy();
    expect(getByTestId('host-kpi-active')).toBeTruthy();
    expect(getByText('Razorpay Route Connected')).toBeTruthy();
    expect(getByTestId('add-spot-button')).toBeTruthy();
    expect(getByText('MG Road Metro Hub Parking')).toBeTruthy();
  });

  it('toggles spot availability via the switch', () => {
    const { getByTestId } = renderScreen();
    const switchEl = getByTestId('switch-spot-host-01');

    expect(switchEl.props.value).toBe(true);
    fireEvent(switchEl, 'valueChange', false);
    expect(switchEl.props.value).toBe(false);
  });

  it('opens Add Spot modal and renders interactive pin-drop map with coordinates', () => {
    const { getByTestId } = renderScreen();

    const addBtn = getByTestId('add-spot-button');
    fireEvent.press(addBtn);

    expect(getByTestId('add-spot-modal')).toBeTruthy();
    expect(getByTestId('host-pin-map')).toBeTruthy();
    expect(getByTestId('host-draggable-pin')).toBeTruthy();
    expect(getByTestId('use-current-location-btn')).toBeTruthy();
    expect(getByTestId('selected-coords-display')).toBeTruthy();
  });

  it('allows host to tap Use Current Location to fetch GPS driveway coordinates', async () => {
    const { getByTestId } = renderScreen();

    const addBtn = getByTestId('add-spot-button');
    fireEvent.press(addBtn);

    const gpsBtn = getByTestId('use-current-location-btn');
    await act(async () => {
      fireEvent.press(gpsBtn);
    });

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
  });

  it('opens Add Spot modal and adds a new parking space with coordinates', async () => {
    const { getByTestId, getByText } = renderScreen();

    const addBtn = getByTestId('add-spot-button');
    fireEvent.press(addBtn);

    expect(getByTestId('add-spot-modal')).toBeTruthy();

    const titleInput = getByTestId('new-spot-title-input');
    const addressInput = getByTestId('new-spot-address-input');
    const rateInput = getByTestId('new-spot-rate-input');
    const submitBtn = getByTestId('submit-add-spot-btn');

    fireEvent.changeText(titleInput, 'Whitefield Secure Bay');
    fireEvent.changeText(addressInput, 'ITPB Main Road, Whitefield');
    fireEvent.changeText(rateInput, '90');

    await act(async () => {
      fireEvent.press(submitBtn);
    });

    await waitFor(() => {
      expect(getByText('Whitefield Secure Bay')).toBeTruthy();
      expect(getByText('ITPB Main Road, Whitefield')).toBeTruthy();
    });
  });
});
