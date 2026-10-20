import React from 'react';
import { Text, Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HostTabParamList } from './types';
import { HostListingsScreen } from '../screens/host/HostListingsScreen';
import { HostReservationsScreen } from '../screens/host/HostReservationsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import colors from '../theme/colors';

const Tab = createBottomTabNavigator<HostTabParamList>();

export const HostNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.hostBadge,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HostListings"
        component={HostListingsScreen}
        options={{
          tabBarLabel: 'My Listings',
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="HostReservations"
        component={HostReservationsScreen}
        options={{
          tabBarLabel: 'Driver Bookings',
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="HostProfile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surfaceElevated,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
});
