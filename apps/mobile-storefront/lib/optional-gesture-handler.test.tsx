import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { View } from 'react-native';

describe('getOptionalGestureHandlerRuntime', () => {
  it('returns the real gesture handler runtime when the module is available', () => {
    jest.isolateModules(() => {
      const Gesture = { Tap: jest.fn() };
      const GestureDetector = jest.fn(() => null);
      const GestureHandlerRootView = jest.fn(() => null);

      jest.doMock('react-native-gesture-handler', () => ({
        Gesture,
        GestureDetector,
        GestureHandlerRootView,
      }));

      const { getOptionalGestureHandlerRuntime } =
        require('./optional-gesture-handler') as typeof import('./optional-gesture-handler');

      const runtime = getOptionalGestureHandlerRuntime();

      expect(runtime.Gesture).toBe(Gesture);
      expect(runtime.GestureDetector).toBe(GestureDetector);
      expect(runtime.GestureHandlerRootView).toBe(GestureHandlerRootView);
    });
  });

  it('falls back when react-native-gesture-handler is unavailable', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native-gesture-handler', () => {
        throw new Error('module unavailable');
      });

      const { getOptionalGestureHandlerRuntime } =
        require('./optional-gesture-handler') as typeof import('./optional-gesture-handler');

      const runtime = getOptionalGestureHandlerRuntime();
      const child = <View testID="child" />;
      const FallbackGestureDetector =
        runtime.GestureDetector as React.FunctionComponent<{
          children?: React.ReactNode;
          gesture?: unknown;
        }>;
      const FallbackGestureHandlerRootView =
        runtime.GestureHandlerRootView as React.FunctionComponent<{
          children?: React.ReactNode;
          style?: import('react-native').ViewStyle;
        }>;
      const fallbackGestureDetector = FallbackGestureDetector({
        children: child,
      });
      const fallbackRootView = FallbackGestureHandlerRootView({
        children: child,
      });

      expect(runtime.Gesture).toBeNull();
      expect(typeof runtime.GestureDetector).toBe('function');
      expect(typeof runtime.GestureHandlerRootView).toBe('function');
      expect(React.isValidElement(fallbackGestureDetector)).toBe(true);
      expect(React.isValidElement(fallbackRootView)).toBe(true);

      if (!React.isValidElement(fallbackGestureDetector)) {
        throw new Error(
          'Expected fallback gesture detector to return a React element'
        );
      }

      if (!React.isValidElement(fallbackRootView)) {
        throw new Error(
          'Expected fallback root view to return a React element'
        );
      }

      const gestureDetectorElement =
        fallbackGestureDetector as React.ReactElement<{
          children?: React.ReactNode;
        }>;
      const rootViewElement = fallbackRootView as React.ReactElement<{
        children?: React.ReactNode;
      }>;

      expect(gestureDetectorElement.type).toBe(React.Fragment);
      expect(gestureDetectorElement.props.children).toBe(child);
      expect(rootViewElement.type).toBe(View);
      expect(rootViewElement.props.children).toBe(child);
    });
  });
});
