import React from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import './global.css';

// Silence third-party NativeWind / CSS interop ImageBackground deprecation warning from terminal and LogBox
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('ImageBackground is deprecated')
  ) {
    return;
  }
  originalWarn(...args);
};

LogBox.ignoreLogs([
  'ImageBackground is deprecated',
]);

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
