import type React from 'react';
import { View, type ViewStyle } from 'react-native';

type GestureHandlerRootViewProps = {
  children?: React.ReactNode;
  style?: ViewStyle;
};

type GestureDetectorProps = {
  children?: React.ReactNode;
  gesture?: unknown;
};

export type GestureHandlerRuntime = {
  Gesture: typeof import('react-native-gesture-handler').Gesture | null;
  GestureDetector: React.ComponentType<GestureDetectorProps>;
  GestureHandlerRootView: React.ComponentType<GestureHandlerRootViewProps>;
};

const FallbackGestureHandlerRootView = ({
  children,
  style,
}: GestureHandlerRootViewProps) => <View style={style}>{children}</View>;

const FallbackGestureDetector = ({ children }: GestureDetectorProps) => (
  <>{children}</>
);

let cachedGestureRuntime: GestureHandlerRuntime | null = null;

export function getOptionalGestureHandlerRuntime(): GestureHandlerRuntime {
  if (cachedGestureRuntime) {
    return cachedGestureRuntime;
  }

  let runtime: GestureHandlerRuntime;
  try {
    const gestureHandler =
      require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');

    runtime = {
      Gesture: gestureHandler.Gesture,
      GestureDetector:
        gestureHandler.GestureDetector as unknown as React.ComponentType<GestureDetectorProps>,
      GestureHandlerRootView: gestureHandler.GestureHandlerRootView,
    };
  } catch {
    runtime = {
      Gesture: null,
      GestureDetector: FallbackGestureDetector,
      GestureHandlerRootView: FallbackGestureHandlerRootView,
    };
  }

  cachedGestureRuntime = runtime;
  return runtime;
}
