import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

describe('Unit Tests: AuthContext & Dual-Persona Engine', () => {
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  it('initializes with default driver persona and demo driver user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.activePersona).toBe('driver');
    expect(result.current.user?.name).toBe('Alex Rivera');
    expect(result.current.user?.role).toBe('driver');
  });

  it('switches persona from driver to host and updates user attributes', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.switchPersona('host');
    });

    expect(result.current.activePersona).toBe('host');
    expect(result.current.user?.role).toBe('host');
    expect(result.current.user?.razorpayAccountId).toBe('acc_ghost_host_882');
  });

  it('toggles persona back and forth seamlessly', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.activePersona).toBe('driver');

    act(() => {
      result.current.togglePersona();
    });
    expect(result.current.activePersona).toBe('host');

    act(() => {
      result.current.togglePersona();
    });
    expect(result.current.activePersona).toBe('driver');
  });

  it('handles user login with specific role', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('host.test@ghostparking.com', 'host');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.activePersona).toBe('host');
    expect(result.current.user?.email).toBe('host.test@ghostparking.com');
  });

  it('handles SSO authentication for google', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginWithSSO('google');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('user@google.com');
    expect(result.current.activePersona).toBe('driver');
  });

  it('handles logout and clears session', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.activePersona).toBe('driver');
  });

  it('throws an error if useAuth is consumed outside AuthProvider', () => {
    // Suppress console error temporarily for intentional throw test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
