import React, { memo, useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SEASONAL } from '@/lib/seasonal';
import { useThemeStore } from '@/stores/theme-store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_SNOWFLAKES = 40; // Optimized for performance

/**
 * Individual Snowflake with Parallax properties
 * 2026 Best Practice: Use seeded randomness based on index to ensure stable values
 * across re-renders and prevent animation value recreation
 */
const Snowflake = memo(({ index, color }: { index: number; color: string }) => {
  // Use index to determine "layer" (0 = back, 1 = mid, 2 = front)
  const layer = index % 3;

  // Parallax properties based on layer
  const scale = 0.5 + (layer * 0.4); // 0.5, 0.9, 1.3
  const speedMultiplier = 0.7 + (layer * 0.3); // Back moves slower

  // 2026 Best Practice: Use index-based seeded values instead of Math.random()
  // This ensures stable values across re-renders and prevents animation recreation
  const seed = (index * 9301 + 49297) % 233280;
  const seededRandom = (offset: number) => ((seed + offset) % 233280) / 233280;

  // Memoize all random-based values with stable seeds
  const xPosition = useMemo(() => seededRandom(0) * SCREEN_WIDTH, []);
  const startY = useMemo(() => -seededRandom(1) * 200, []);
  const duration = useMemo(() => (6000 + seededRandom(2) * 4000) / speedMultiplier, [speedMultiplier]);
  const delay = useMemo(() => seededRandom(3) * 8000, []);
  const size = useMemo(() => (3 + seededRandom(4) * 4) * scale, [scale]);

  // 2026 Best Practice: Initialize shared values with stable starting values
  const translateY = useSharedValue(startY);
  const opacity = useSharedValue(0.4 + (layer * 0.2));

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(SCREEN_HEIGHT + 100, {
          duration: duration,
          easing: Easing.bezier(0.45, 0, 0.55, 1), // Smoother falling curve
        }),
        -1
      )
    );

    return () => {
      cancelAnimation(translateY);
    };
  }, [delay, duration, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.snowflake,
        {
          left: xPosition,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
});

/**
 * SnowEffect - Elite 2026 Implementation
 */
export function SnowEffect() {
  const theme = useThemeStore((state) => state.theme);
  const tokens = useMemo(() => SEASONAL.getTokens(theme), [theme]);

  if (!tokens.isSanta) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: NUM_SNOWFLAKES }).map((_, i) => (
        <Snowflake key={i} index={i} color={tokens.snowColor} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  snowflake: {
    position: 'absolute',
    top: 0,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
});
