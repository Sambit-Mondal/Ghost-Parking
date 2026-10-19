/* eslint-disable no-undef */
import { Animated } from 'react-native';

// Setup Reanimated mock for Jest in SDK 57
jest.mock('react-native-worklets', () => ({}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const MockSafeAreaView = (props) => props.children;
  MockSafeAreaView.displayName = 'SafeAreaView';
  return {
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaConsumer: jest.fn(({ children }) => children(inset)),
    SafeAreaView: MockSafeAreaView,
    useSafeAreaInsets: jest.fn(() => inset),
    useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 390, height: 844 })),
  };
});

// Synchronous Animated mock to prevent background timers and act(...) warnings
const createMockAnimation = (value, config) => ({
  start: (callback) => {
    if (value && config && config.toValue !== undefined) {
      if (typeof value.setValue === 'function') {
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
