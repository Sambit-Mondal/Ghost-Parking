/* eslint-disable no-undef */
import { Animated } from 'react-native';

// Setup Reanimated mock for Jest in SDK 57
jest.mock('react-native-worklets', () => ({}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock @expo/vector-icons and font loading for Jest
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => true),
}));

jest.mock('@expo/vector-icons', () => {
  return {
    Ionicons: 'Ionicons',
    MaterialCommunityIcons: 'MaterialCommunityIcons',
    Feather: 'Feather',
    AntDesign: 'AntDesign',
    FontAwesome: 'FontAwesome',
  };
});

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: {
      latitude: 12.9716,
      longitude: 77.5946,
      altitude: 0,
      accuracy: 5,
      altitudeAccuracy: 5,
      heading: 0,
      speed: 0,
    },
  })),
  Accuracy: {
    Balanced: 3,
    High: 4,
  },
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const initialInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const InsetsContext = React.createContext(initialInsets);
  const FrameContext = React.createContext({ x: 0, y: 0, width: 390, height: 844 });
  const MockSafeAreaView = (props) => props.children;
  MockSafeAreaView.displayName = 'SafeAreaView';
  return {
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaConsumer: InsetsContext.Consumer,
    SafeAreaInsetsContext: InsetsContext,
    SafeAreaFrameContext: FrameContext,
    SafeAreaView: MockSafeAreaView,
    useSafeAreaInsets: jest.fn(() => initialInsets),
    useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
  };
});

// Mock expo-secure-store for in-memory token persistence in tests
const mockSecureStore = new Map();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key) => mockSecureStore.get(key) || null),
  setItemAsync: jest.fn(async (key, value) => {
    mockSecureStore.set(key, String(value));
  }),
  deleteItemAsync: jest.fn(async (key) => {
    mockSecureStore.delete(key);
  }),
  __clearMockStore: () => mockSecureStore.clear(),
}));



// Synchronous Animated mock to prevent background timers and act(...) warnings
const createMockAnimation = (value, config) => ({
  start: (callback) => {
    if (value && config && config.toValue !== undefined) {
      if (typeof value.setValue === 'function' && value._value !== config.toValue) {
        value.setValue(config.toValue);
      }
    }
    if (typeof callback === 'function') {
      callback({ finished: true });
    }
  },
  stop: jest.fn(),
  reset: jest.fn(),
});

Animated.timing = jest.fn(createMockAnimation);
Animated.spring = jest.fn(createMockAnimation);

afterEach(() => {
  jest.clearAllTimers();
});
