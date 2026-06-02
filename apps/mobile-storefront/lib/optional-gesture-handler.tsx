import type React from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

type GestureHandlerRootViewProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

type GestureDetectorProps = {
  children?: React.ReactNode;
  gesture?: unknown;
};

export type GestureHandlerRuntime = {
  Gesture: typeof import('react-native-gesture-handler').Gesture | null;
  GestureDetector: React.ComponentType<GestureDetectorProps>;
  GestureHandlerRootView: React.ComponentType<GestureHandlerRootViewProps>;
  usePanGesture: typeof import('react-native-gesture-handler').usePanGesture;
  useSimultaneousGestures: typeof import('react-native-gesture-handler').useSimultaneousGestures;
  useTapGesture: typeof import('react-native-gesture-handler').useTapGesture;
};

const FallbackGestureHandlerRootView = ({
  children,
  style,
}: GestureHandlerRootViewProps) => <View style={style}>{children}</View>;

const FallbackGestureDetector = ({ children }: GestureDetectorProps) => (
  <>{children}</>
);

const fallbackPanGesture =
  (() => null) as unknown as typeof import('react-native-gesture-handler').usePanGesture;
const fallbackTapGesture =
  (() => null) as unknown as typeof import('react-native-gesture-handler').useTapGesture;
const fallbackSimultaneousGestures =
  (() => null) as unknown as typeof import('react-native-gesture-handler').useSimultaneousGestures;

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
        (gestureHandler.GestureDetector as unknown as React.ComponentType<GestureDetectorProps>) ??
        FallbackGestureDetector,
      GestureHandlerRootView:
        gestureHandler.GestureHandlerRootView ?? FallbackGestureHandlerRootView,
      usePanGesture: gestureHandler.usePanGesture ?? fallbackPanGesture,
      useSimultaneousGestures:
        gestureHandler.useSimultaneousGestures ?? fallbackSimultaneousGestures,
      useTapGesture: gestureHandler.useTapGesture ?? fallbackTapGesture,
    };
  } catch {
    runtime = {
      Gesture: null,
      GestureDetector: FallbackGestureDetector,
      GestureHandlerRootView: FallbackGestureHandlerRootView,
      usePanGesture: fallbackPanGesture,
      useSimultaneousGestures: fallbackSimultaneousGestures,
      useTapGesture: fallbackTapGesture,
    };
  }

  cachedGestureRuntime = runtime;
  return runtime;
}
