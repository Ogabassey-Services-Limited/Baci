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
  const MockAnimatedView = ({ children, style, ...props }: any) =>
    React.createElement(View, { style, ...props }, children);
  const MockAnimatedText = ({ children, style, ...props }: any) =>
    React.createElement(Text, { style, ...props }, children);

  const mock = {
    useSharedValue: (initVal: any) => ({ value: initVal }),
    useAnimatedStyle: (fn: any) => fn(),
    withSpring: (toValue: any) => toValue,
    withTiming: (toValue: any) => toValue,
    withRepeat: (anim: any) => anim,
    withSequence: (...anims: any[]) => anims[0],
    cancelAnimation: jest.fn(),
    useDerivedValue: (fn: any) => ({
      get value() {
        return fn();
      },
    }),
    useEvent: (fn: any) => fn,
    interpolate: (
      value: number,
      inputRange: number[],
      outputRange: number[]
    ) => {
      const idx = inputRange.indexOf(value);
      if (idx !== -1) return outputRange[idx];
      return outputRange[0];
    },
    interpolateColor: (
      value: number,
      inputRange: number[],
      outputRange: string[]
    ) => {
      const idx = inputRange.indexOf(value);
      if (idx !== -1) return outputRange[idx];
      return outputRange[0];
    },
    Extrapolation: {
      CLAMP: 'clamp',
    },
    View: MockAnimatedView,
    Text: MockAnimatedText,
    createAnimatedComponent: (component: any) => component,
    __esModule: true,
  };

  Object.defineProperty(mock, 'default', {
    enumerable: true,
    value: mock,
  });

  return mock;
});

// Mock react-native-worklets
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: any[]) => any, ...args: any[]) => fn(...args),
  scheduleOnUI: (fn: (...args: any[]) => any, ...args: any[]) => fn(...args),
  runOnJS: (fn: (...args: any[]) => any) => fn,
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  return {
    Touchable: ({ children, ...props }: any) =>
      React.createElement(Pressable, props, children),
    GestureDetector: ({ children }: any) => children,
    usePanGesture: jest.fn(() => ({})),
    useTapGesture: jest.fn(() => ({})),
    useSimultaneousGestures: jest.fn((...args: any[]) => ({})),
  };
});

// Mock react-native-pager-view
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  class MockPagerView extends React.Component {
    setPage = jest.fn();
    setPageWithoutAnimation = jest.fn();
    render() {
      const { children, ...props } = this.props;
      return React.createElement(
        View,
        { testID: 'pager-view', ...props },
        children
      );
    }
  }
  return {
    __esModule: true,
    default: MockPagerView,
  };
});

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  return {
    createMMKV: jest.fn().mockImplementation(() => {
      const store = new Map<string, string>();
      return {
        set: jest.fn((key: string, value: string) => {
          store.set(key, value);
        }),
        getString: jest.fn((key: string) => {
          return store.get(key) ?? null;
        }),
        getNumber: jest.fn((key: string) => {
          const val = store.get(key);
          return val ? Number(val) : null;
        }),
        getBoolean: jest.fn((key: string) => {
          const val = store.get(key);
          return val === 'true';
        }),
        remove: jest.fn((key: string) => {
          store.delete(key);
        }),
        clearAll: jest.fn(() => {
          store.clear();
        }),
        getAllKeys: jest.fn(() => {
          return Array.from(store.keys());
        }),
      };
    }),
  };
});

