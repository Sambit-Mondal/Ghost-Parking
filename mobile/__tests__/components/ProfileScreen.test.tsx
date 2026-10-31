import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '../../src/screens/profile/ProfileScreen';
import { DriverProfileScreen } from '../../src/screens/profile/DriverProfileScreen';
import { HostProfileScreen } from '../../src/screens/profile/HostProfileScreen';
import { AuthProvider, User } from '../../src/context/AuthContext';

describe('Component Test: Role-Isolated Profile Screens', () => {
  const driverUser: User = {
    id: 'usr_driver_test',
    name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    role: 'driver',
    phone: '+91 98765 43210',
  };

  const hostUser: User = {
    id: 'usr_host_test',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    role: 'host',
    phone: '+91 91234 56789',
    razorpayAccountId: 'acc_ghost_host_882',
  };

  it('renders dedicated DriverProfileScreen with driver verification attributes', () => {
    const { getByText, getByTestId } = render(
      <AuthProvider initialToken="driver_token" initialRole="driver" initialUser={driverUser}>
        <DriverProfileScreen />
      </AuthProvider>
    );

    expect(getByText('Alex Rivera')).toBeTruthy();
    expect(getByText('alex.rivera@example.com')).toBeTruthy();
    expect(getByText('Driver Account')).toBeTruthy();
    expect(getByText('GPS Check-In Threshold')).toBeTruthy();
    expect(getByText('< 50 Meters Required')).toBeTruthy();
    expect(getByTestId('logout-button')).toBeTruthy();
  });

  it('renders dedicated HostProfileScreen with host escrow payout routing', () => {
    const { getByText, getByTestId } = render(
      <AuthProvider initialToken="host_token" initialRole="host" initialUser={hostUser}>
        <HostProfileScreen />
      </AuthProvider>
    );

    expect(getByText('Sarah Chen')).toBeTruthy();
    expect(getByText('sarah.chen@example.com')).toBeTruthy();
    expect(getByText('Host Account')).toBeTruthy();
    expect(getByText('Razorpay Route Account')).toBeTruthy();
    expect(getByText('acc_ghost_host_882')).toBeTruthy();
    expect(getByText('80% Net per Hour')).toBeTruthy();
    expect(getByTestId('logout-button')).toBeTruthy();
  });

  it('ProfileScreen automatically delegates to role-specific screen based on userRole', () => {
    const { getByText } = render(
      <AuthProvider initialToken="host_token" initialRole="host" initialUser={hostUser}>
        <ProfileScreen />
      </AuthProvider>
    );

    expect(getByText('Host Profile')).toBeTruthy();
    expect(getByText('Host Revenue Share')).toBeTruthy();
  });

  it('triggers logout button without throwing', () => {
    const { getByTestId } = render(
      <AuthProvider initialToken="driver_token" initialRole="driver" initialUser={driverUser}>
        <DriverProfileScreen />
      </AuthProvider>
    );
    const logoutBtn = getByTestId('logout-button');

    fireEvent.press(logoutBtn);
    expect(logoutBtn).toBeTruthy();
  });
});
