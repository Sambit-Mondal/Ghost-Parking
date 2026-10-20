import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { DriverNavigator } from './DriverNavigator';
import { HostNavigator } from './HostNavigator';
import colors from '../theme/colors';

const ghostTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surfaceElevated,
    text: colors.textPrimary,
    border: colors.border,
  },
};

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, activePersona } = useAuth();

  return (
    <NavigationContainer theme={ghostTheme}>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : activePersona === 'host' ? (
        <HostNavigator />
      ) : (
        <DriverNavigator />
      )}
    </NavigationContainer>
  );
};
