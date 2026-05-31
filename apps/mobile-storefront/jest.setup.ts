import '@testing-library/jest-native/extend-expect';
import React, { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

// Resolve Expo's lazy fetch polyfill before test teardown can invalidate native mocks.
void globalThis.fetch;

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
  require('./__mocks__/async-storage')
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

// Mock vector icons
jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: 'Ionicons',
  __esModule: true,
  default: 'Ionicons',
}));

jest.mock('@react-native-vector-icons/fontawesome', () => ({
  FontAwesome: 'FontAwesome',
  __esModule: true,
  default: 'FontAwesome',
}));

jest.mock('@react-native-vector-icons/feather', () => ({
  Feather: 'Feather',
  __esModule: true,
  default: 'Feather',
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text } = require('react-native');

  type MockComponentProps = Record<string, unknown> & {
    children?: unknown;
    style?: unknown;
  };

  const MockAnimatedView = ({
    children,
    style,
    ...props
  }: MockComponentProps) =>
    React.createElement(View, { style, ...props }, children);
  const MockAnimatedText = ({
    children,
    style,
    ...props
  }: MockComponentProps) =>
    React.createElement(Text, { style, ...props }, children);

  const mock = {
    useSharedValue: (initVal: unknown) => {
      let currentValue = initVal;
      return {
        get value() {
          return currentValue;
        },
        set value(nextValue: unknown) {
          currentValue = nextValue;
        },
        get: () => currentValue,
        set: (nextValue: unknown) => {
          currentValue = nextValue;
        },
      };
    },
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withSpring: (toValue: unknown) => toValue,
    withTiming: (toValue: unknown) => toValue,
    withRepeat: (anim: unknown) => anim,
    withSequence: (...anims: unknown[]) => anims[0],
    cancelAnimation: jest.fn(),
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    View: MockAnimatedView,
    Text: MockAnimatedText,
    createAnimatedComponent: (component: unknown) => component,
    __esModule: true,
  };

  Object.defineProperty(mock, 'default', {
    enumerable: true,
    value: mock,
  });

  return mock;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  const createGesture = (): Record<string, (...args: unknown[]) => unknown> => {
    const gesture: Record<string, (...args: unknown[]) => unknown> = {};
    const chain = () => gesture;

    gesture.activeOffsetX = jest.fn(chain);
    gesture.maxDistance = jest.fn(chain);
    gesture.maxPointers = jest.fn(chain);
    gesture.minDistance = jest.fn(chain);
    gesture.minPointers = jest.fn(chain);
    gesture.numberOfTaps = jest.fn(chain);
    gesture.onEnd = jest.fn(chain);
    gesture.onStart = jest.fn(chain);
    gesture.onUpdate = jest.fn(chain);

    return gesture;
  };

  return {
    GestureDetector: ({ children }: { children?: unknown }) => children,
    GestureHandlerRootView: ({
      children,
      style,
    }: {
      children?: unknown;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
    Gesture: {
      Pan: jest.fn(createGesture),
      Race: jest.fn((...gestures: unknown[]) => ({
        gestures,
        type: 'race',
      })),
      Simultaneous: jest.fn((...gestures: unknown[]) => ({
        gestures,
        type: 'simultaneous',
      })),
      Tap: jest.fn(createGesture),
    },
  };
});
