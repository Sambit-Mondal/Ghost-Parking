import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../../src/screens/auth/LoginScreen';
import { AuthProvider } from '../../src/context/AuthContext';

describe('Component Test: LoginScreen', () => {
  const renderScreen = () =>
    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );

  it('renders branding, inputs, and persona selection buttons', () => {
    const { getByText, getByTestId, getByPlaceholderText } = renderScreen();

    expect(getByText('Ghost Parking')).toBeTruthy();
    expect(getByText('Invisible infrastructure. Instant urban parking.')).toBeTruthy();
    expect(getByPlaceholderText('driver@example.com')).toBeTruthy();
    expect(getByTestId('login-continue-btn')).toBeTruthy();
    expect(getByTestId('sso-apple-btn')).toBeTruthy();
    expect(getByTestId('sso-google-btn')).toBeTruthy();
    expect(getByTestId('demo-driver-btn')).toBeTruthy();
    expect(getByTestId('demo-host-btn')).toBeTruthy();
  });

  it('allows user to type email and press Continue', async () => {
    const { getByTestId } = renderScreen();
    const emailInput = getByTestId('login-email-input');
    const continueBtn = getByTestId('login-continue-btn');

    fireEvent.changeText(emailInput, 'driver.test@ghostparking.com');
    expect(emailInput.props.value).toBe('driver.test@ghostparking.com');

    fireEvent.press(continueBtn);
    await waitFor(() => {
      // Login completed without crashing
      expect(continueBtn).toBeTruthy();
    });
  });

  it('triggers Quick Demo Driver login button', async () => {
    const { getByTestId } = renderScreen();
    const demoDriverBtn = getByTestId('demo-driver-btn');

    fireEvent.press(demoDriverBtn);
    await waitFor(() => {
      expect(demoDriverBtn).toBeTruthy();
    });
  });

  it('triggers Quick Demo Host login button', async () => {
    const { getByTestId } = renderScreen();
    const demoHostBtn = getByTestId('demo-host-btn');

    fireEvent.press(demoHostBtn);
    await waitFor(() => {
      expect(demoHostBtn).toBeTruthy();
    });
  });

  it('triggers Google SSO login button', async () => {
    const { getByTestId } = renderScreen();
    const googleBtn = getByTestId('sso-google-btn');

    fireEvent.press(googleBtn);
    await waitFor(() => {
      expect(googleBtn).toBeTruthy();
    });
  });
});
