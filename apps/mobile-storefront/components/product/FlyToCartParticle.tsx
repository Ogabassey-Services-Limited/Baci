/**
 * FlyToCartParticle - Animated particle that flies from the add-to-cart button
 * to the cart tab icon, providing tactile feedback for cart additions.
 */

import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '@/constants/Colors';

// Tab bar layout constants for fly-to-cart animation targeting
const CART_TAB_INDEX = 2; // Cart is the 3rd tab (0-indexed)
const TAB_COUNT = 4; // Total number of tabs

export interface FlyToCartParticleProps {
  startX: number;
  startY: number;
  onComplete?: () => void;
}

export function FlyToCartParticle({
  startX,
  startY,
  onComplete,
}: FlyToCartParticleProps) {
  const progress = useSharedValue(0);
  const particleInsets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const targetX = (width / TAB_COUNT) * CART_TAB_INDEX + width / TAB_COUNT / 2; // Center of cart tab
  const targetY = height - (particleInsets.bottom + 30); // Tab bar center

  useEffect(() => {
    progress.set(
      withTiming(
        1,
        {
          duration: 800,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        },
        (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        }
      )
    );
  }, [progress, onComplete]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.get(), [0, 1], [startX, targetX]);
    const translateY = interpolate(progress.get(), [0, 1], [startY, targetY]);
    const scale = interpolate(progress.get(), [0, 0.5, 1], [1, 1.2, 0.2]);
    const opacity = interpolate(progress.get(), [0, 0.8, 1], [1, 1, 0]);

    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: BRAND.primary,
      zIndex: 9999,
      transform: [
        { translateX: translateX - 20 },
        { translateY: translateY - 20 },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={animatedStyle}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    />
  );
}
