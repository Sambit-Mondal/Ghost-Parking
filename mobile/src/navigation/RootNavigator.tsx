import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
  const { isLoading, userToken, userRole } = useAuth();

  // Show splash loader while restoring token from expo-secure-store
  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="root-loading-indicator">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={ghostTheme}>
      {!userToken ? (
        <AuthNavigator />
      ) : userRole === 'host' ? (
        <HostNavigator />
      ) : (
        <DriverNavigator />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
