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

// These fallbacks are plain element factories rather than PascalCase component
// declarations on purpose. React Compiler instruments component-shaped functions
// by injecting a `useMemoCache` hook call, which throws when a function is invoked
// outside React's render cycle (e.g. called directly as a function). Keeping them
// as lowercase factories means the compiler treats them as ordinary functions, so
// they remain safe to call directly while still working as JSX components.
const fallbackGestureHandlerRootView = ({
  children,
  style,
}: GestureHandlerRootViewProps) => <View style={style}>{children}</View>;

const fallbackGestureDetector = ({ children }: GestureDetectorProps) => (
  <>{children}</>
);

const fallbackPanGesture = (() =>
  null) as unknown as typeof import('react-native-gesture-handler').usePanGesture;
const fallbackTapGesture = (() =>
  null) as unknown as typeof import('react-native-gesture-handler').useTapGesture;
const fallbackSimultaneousGestures = (() =>
  null) as unknown as typeof import('react-native-gesture-handler').useSimultaneousGestures;

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
        fallbackGestureDetector,
      GestureHandlerRootView:
        gestureHandler.GestureHandlerRootView ?? fallbackGestureHandlerRootView,
      usePanGesture: gestureHandler.usePanGesture ?? fallbackPanGesture,
      useSimultaneousGestures:
        gestureHandler.useSimultaneousGestures ?? fallbackSimultaneousGestures,
      useTapGesture: gestureHandler.useTapGesture ?? fallbackTapGesture,
    };
  } catch {
    runtime = {
      Gesture: null,
      GestureDetector: fallbackGestureDetector,
      GestureHandlerRootView: fallbackGestureHandlerRootView,
      usePanGesture: fallbackPanGesture,
      useSimultaneousGestures: fallbackSimultaneousGestures,
      useTapGesture: fallbackTapGesture,
    };
  }

  cachedGestureRuntime = runtime;
  return runtime;
}
