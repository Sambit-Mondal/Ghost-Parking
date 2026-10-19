import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '../../src/screens/profile/ProfileScreen';
import { AuthProvider } from '../../src/context/AuthContext';

describe('Component Test: ProfileScreen', () => {
  const renderScreen = () =>
    render(
      <AuthProvider>
        <ProfileScreen />
      </AuthProvider>
    );

  it('renders user details, persona switch options, and Razorpay section', () => {
    const { getByText, getByTestId } = renderScreen();

    expect(getByText('Alex Rivera')).toBeTruthy();
    expect(getByText('alex.rivera@example.com')).toBeTruthy();
    expect(getByTestId('persona-select-driver')).toBeTruthy();
    expect(getByTestId('persona-select-host')).toBeTruthy();
    expect(getByText('Razorpay Network')).toBeTruthy();
    expect(getByTestId('logout-button')).toBeTruthy();
  });

  it('switches persona to Host when pressing Host View', () => {
    const { getByTestId, getByText } = renderScreen();

    const hostOption = getByTestId('persona-select-host');
    fireEvent.press(hostOption);

    // Profile updates persona mode text
    expect(getByText('Currently managing parking bays & earning as a Host.')).toBeTruthy();
    expect(getByText('🏠 Active Host')).toBeTruthy();
  });

  it('switches back to Driver when pressing Driver View', () => {
    const { getByTestId, getByText } = renderScreen();

    const hostOption = getByTestId('persona-select-host');
    fireEvent.press(hostOption);

    const driverOption = getByTestId('persona-select-driver');
    fireEvent.press(driverOption);

    expect(getByText('Currently browsing & reserving parking as a Driver.')).toBeTruthy();
    expect(getByText('🚗 Active Driver')).toBeTruthy();
  });

  it('triggers logout button without throwing', () => {
    const { getByTestId } = renderScreen();
    const logoutBtn = getByTestId('logout-button');

    fireEvent.press(logoutBtn);
    expect(logoutBtn).toBeTruthy();
  });
});
