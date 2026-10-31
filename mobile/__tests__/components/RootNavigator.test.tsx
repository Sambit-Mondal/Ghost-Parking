import React from 'react';
import { render } from '@testing-library/react-native';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { AuthProvider, User } from '../../src/context/AuthContext';

describe('Component Test: RootNavigator Conditional Role-Based Rendering', () => {
  it('renders AuthNavigator (Login Screen) when no token exists (!userToken)', () => {
    const { getByText, queryByTestId } = render(
      <AuthProvider initialToken={null} initialRole={null} initialUser={null}>
        <RootNavigator />
      </AuthProvider>
    );

    // Auth stack elements
    expect(getByText('Ghost Parking')).toBeTruthy();
    expect(getByText('LOG IN AS')).toBeTruthy();
    // Driver map should NOT be rendered
    expect(queryByTestId('driver-native-map')).toBeNull();
  });

  it('renders DriverTabNavigator when token exists and userRole is driver', () => {
    const driverUser: User = {
      id: 'driver_test_01',
      name: 'Driver Dave',
      email: 'dave@ghostparking.test',
      role: 'driver',
    };

    const { getByTestId, queryByText } = render(
      <AuthProvider
        initialToken="valid_driver_jwt_token"
        initialRole="driver"
        initialUser={driverUser}
      >
        <RootNavigator />
      </AuthProvider>
    );

    // Driver map should be rendered
    expect(getByTestId('driver-map-placeholder')).toBeTruthy();
    // Auth login elements should NOT be rendered
    expect(queryByText('LOG IN AS')).toBeNull();
  });

  it('renders HostTabNavigator when token exists and userRole is host', () => {
    const hostUser: User = {
      id: 'host_test_01',
      name: 'Host Helen',
      email: 'helen@ghostparking.test',
      role: 'host',
      razorpayAccountId: 'acc_host_999',
    };

    const { getByTestId, queryByTestId, queryByText } = render(
      <AuthProvider
        initialToken="valid_host_jwt_token"
        initialRole="host"
        initialUser={hostUser}
      >
        <RootNavigator />
      </AuthProvider>
    );

    // Host listings screen elements
    expect(getByTestId('add-spot-button')).toBeTruthy();
    // Driver map should NOT be rendered
    expect(queryByTestId('driver-map-placeholder')).toBeNull();
    // Auth stack should NOT be rendered
    expect(queryByText('LOG IN AS')).toBeNull();
  });
});
