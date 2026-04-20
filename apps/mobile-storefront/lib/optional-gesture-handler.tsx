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

type GestureHandlerRuntime = {
  Gesture: typeof import('react-native-gesture-handler').Gesture | null;
  GestureDetector: (props: GestureDetectorProps) => React.ReactElement | null;
  GestureHandlerRootView: (
    props: GestureHandlerRootViewProps
  ) => React.ReactElement | null;
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

  try {
    const gestureHandler =
      require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');
    const runtime: GestureHandlerRuntime = {
      Gesture: gestureHandler.Gesture,
      GestureDetector: gestureHandler.GestureDetector as unknown as (
        props: GestureDetectorProps
      ) => React.ReactElement | null,
      GestureHandlerRootView:
        gestureHandler.GestureHandlerRootView as unknown as (
          props: GestureHandlerRootViewProps
        ) => React.ReactElement | null,
    };

    cachedGestureRuntime = runtime;
  } catch {
    const runtime: GestureHandlerRuntime = {
      Gesture: null,
      GestureDetector: FallbackGestureDetector,
      GestureHandlerRootView: FallbackGestureHandlerRootView,
    };

    cachedGestureRuntime = runtime;
  }

  return cachedGestureRuntime;
}
