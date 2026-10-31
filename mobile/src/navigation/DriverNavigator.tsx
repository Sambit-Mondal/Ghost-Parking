import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { DriverTabParamList } from './types';
import { DriverMapScreen } from '../screens/driver/DriverMapScreen';
import { DriverBookingsScreen } from '../screens/driver/DriverBookingsScreen';
import { DriverProfileScreen } from '../screens/profile/DriverProfileScreen';
import colors from '../theme/colors';

const Tab = createBottomTabNavigator<DriverTabParamList>();

export const DriverNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="DriverMap"
        component={DriverMapScreen}
        options={{
          tabBarLabel: 'Find Spot',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size || 20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverBookings"
        component={DriverBookingsScreen}
        options={{
          tabBarLabel: 'Reservations',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size || 20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
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
