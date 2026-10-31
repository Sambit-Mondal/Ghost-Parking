import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HostTabParamList } from './types';
import { HostListingsScreen } from '../screens/host/HostListingsScreen';
import { HostReservationsScreen } from '../screens/host/HostReservationsScreen';
import { HostProfileScreen } from '../screens/profile/HostProfileScreen';
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size || 20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="HostReservations"
        component={HostReservationsScreen}
        options={{
          tabBarLabel: 'Driver Bookings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size || 20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="HostProfile"
        component={HostProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size || 20} color={color} />
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
    letterSpacing: 0.3,
  },
});
