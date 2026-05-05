import '@testing-library/jest-native/extend-expect';
import React, { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

function mockKeyboardProvider({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement(
    View,
    { testID: 'keyboard-provider', ...props },
    children
  );
}

function mockKeyboardAwareScrollView({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement(
    ScrollView,
    { testID: 'keyboard-aware-scroll-view', ...props },
    children
  );
}

function mockKeyboardAvoidingView({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return React.createElement(
    View,
    { testID: 'keyboard-container', ...props },
    children
  );
}

mockKeyboardProvider.displayName = 'MockKeyboardProvider';
mockKeyboardAwareScrollView.displayName = 'MockKeyboardAwareScrollView';
mockKeyboardAvoidingView.displayName = 'MockKeyboardAvoidingView';

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: mockKeyboardAwareScrollView,
  KeyboardAvoidingView: mockKeyboardAvoidingView,
  KeyboardProvider: mockKeyboardProvider,
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require(
    `${__dirname}/../../node_modules/@react-native-async-storage/async-storage/lib/module/jest/AsyncStorageMock.js`
  )
);

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  Link: 'Link',
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));
