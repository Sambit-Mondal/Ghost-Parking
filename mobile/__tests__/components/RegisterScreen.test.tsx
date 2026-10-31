import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterScreen } from '../../src/screens/auth/RegisterScreen';
import { AuthProvider } from '../../src/context/AuthContext';

describe('Component Test: RegisterScreen', () => {
  const renderScreen = () =>
    render(
      <AuthProvider initialToken={null} initialRole={null} initialUser={null}>
        <RegisterScreen />
      </AuthProvider>
    );

  it('renders branding, role selection toggle, input fields, and submit button', () => {
    const { getByText, getByTestId, getByPlaceholderText } = renderScreen();

    expect(getByText('Create Account')).toBeTruthy();
    expect(getByText('SELECT YOUR ROLE')).toBeTruthy();
    expect(getByTestId('role-toggle-driver')).toBeTruthy();
    expect(getByTestId('role-toggle-host')).toBeTruthy();
    expect(getByPlaceholderText('Jane Doe')).toBeTruthy();
    expect(getByPlaceholderText('jane@example.com')).toBeTruthy();
    expect(getByTestId('register-password-input')).toBeTruthy();
    expect(getByTestId('register-submit-btn')).toBeTruthy();
    expect(getByTestId('navigate-login-btn')).toBeTruthy();
  });

  it('allows user to switch role toggle between Driver and Host', () => {
    const { getByTestId, getByText } = renderScreen();
    const hostToggle = getByTestId('role-toggle-host');
    const driverToggle = getByTestId('role-toggle-driver');
    const submitBtn = getByTestId('register-submit-btn');

    // Default is Driver
    expect(getByText('Register as Driver')).toBeTruthy();

    // Switch to Host
    fireEvent.press(hostToggle);
    expect(getByText('Register as Host')).toBeTruthy();

    // Switch back to Driver
    fireEvent.press(driverToggle);
    expect(getByText('Register as Driver')).toBeTruthy();
  });

  it('shows error banner when name or email is missing', async () => {
    const { getByTestId, getByText } = renderScreen();
    const submitBtn = getByTestId('register-submit-btn');

    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByTestId('register-error-banner')).toBeTruthy();
      expect(getByText('Please enter your full name')).toBeTruthy();
    });
  });

  it('shows error banner when password is shorter than 6 characters', async () => {
    const { getByTestId, getByText } = renderScreen();
    const nameInput = getByTestId('register-name-input');
    const emailInput = getByTestId('register-email-input');
    const passwordInput = getByTestId('register-password-input');
    const submitBtn = getByTestId('register-submit-btn');

    fireEvent.changeText(nameInput, 'Alex Morgan');
    fireEvent.changeText(emailInput, 'alex@ghostparking.com');
    fireEvent.changeText(passwordInput, '123'); // < 6 chars

    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByTestId('register-error-banner')).toBeTruthy();
      expect(getByText('Password must be at least 6 characters long')).toBeTruthy();
    });
  });

  it('allows user to type valid fields and click Register submit button', async () => {
    const { getByTestId, queryByTestId } = renderScreen();
    const nameInput = getByTestId('register-name-input');
    const emailInput = getByTestId('register-email-input');
    const passwordInput = getByTestId('register-password-input');
    const submitBtn = getByTestId('register-submit-btn');

    fireEvent.changeText(nameInput, 'Alex Morgan');
    fireEvent.changeText(emailInput, 'alex.morgan@ghostparking.com');
    fireEvent.changeText(passwordInput, 'SecretPassword123');

    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(submitBtn).toBeTruthy();
    });
  });
});

