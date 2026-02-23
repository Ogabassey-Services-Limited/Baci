/**
 * useBottomSheetAnimation Hook
 * Handles bottom sheet slide and backdrop animations with reduced motion support
 *
 * 2026 Best Practices:
 * - Respects user's reduced motion preferences
 * - Reanimated 3 worklet-based animations
 * - Encapsulated animation logic for reusability
 */

import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

interface UseBottomSheetAnimationOptions {
  isOpen: boolean;
  /** Distance to translate when closed (default: 500) */
  translateDistance?: number;
}

interface UseBottomSheetAnimationReturn {
  animatedBackdropStyle: AnimatedStyle<ViewStyle>;
  animatedSheetStyle: AnimatedStyle<ViewStyle>;
  /** Whether reduced motion is enabled */
  reducedMotion: boolean;
}

export function useBottomSheetAnimation({
  isOpen,
  translateDistance = 500,
}: UseBottomSheetAnimationOptions): UseBottomSheetAnimationReturn {
  const reducedMotion = useReducedMotion();

  // Animation shared values
  const translateY = useSharedValue(translateDistance);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    const openBackdropDuration = reducedMotion ? 0 : 200;
    const openSheetDuration = reducedMotion ? 0 : 300;
    const closeBackdropDuration = reducedMotion ? 0 : 150;
    const closeSheetDuration = reducedMotion ? 0 : 200;

    if (isOpen) {
      backdropOpacity.value = withTiming(1, {
        duration: openBackdropDuration,
      });
      translateY.value = withTiming(0, {
        duration: openSheetDuration,
      });
    } else {
      backdropOpacity.value = withTiming(0, {
        duration: closeBackdropDuration,
      });
      translateY.value = withTiming(translateDistance, {
        duration: closeSheetDuration,
      });
    }
  }, [
    isOpen,
    translateDistance,
    reducedMotion,
    backdropOpacity,
    translateY,
  ]);

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return {
    animatedBackdropStyle,
    animatedSheetStyle,
    reducedMotion,
  };
}
