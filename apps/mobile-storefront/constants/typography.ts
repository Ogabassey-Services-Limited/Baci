import { Dimensions } from 'react-native';

// M28: Intentionally static — captured once at module load for the `clamp()` fluid
// typography helper below. This file is a constants module (not a component), so
// useWindowDimensions() is not applicable. Font sizes are computed once at startup;
// dynamic orientation changes do not require recalculating typography constants.
export const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Simplified React Native typography scaling helper.
 * clamp(min, max, baseWidth) scales min by SCREEN_WIDTH / baseWidth, then
 * constrains the result to [min, max]. This is not CSS clamp(): there is no
 * separate preferred value or viewport-unit expression.
 * @param min - Minimum font size and base value to scale (px)
 * @param max - Maximum font size (px)
 * @param baseWidth - Base screen width for scaling (default: 375px)
 */
export const clamp = (min: number, max: number, baseWidth: number = 375) => {
  const scaled = (SCREEN_WIDTH / baseWidth) * min;
  return Math.min(Math.max(scaled, min), max);
};

export const TYPOGRAPHY = {
  // Font sizes (matching web fluid scale - mobile equivalents)
  size: {
    xs: clamp(10, 12),
    sm: clamp(12, 14),
    base: clamp(14, 16),
    lg: clamp(16, 20),
    xl: clamp(20, 24),
    '2xl': clamp(24, 32),
    '3xl': clamp(32, 40),
    '4xl': clamp(40, 56),
    '5xl': clamp(48, 72),
    hero: clamp(32, 48), // Dedicated hero size
  },
  // Font weights (numeric strings as required by React Native fontWeight)
  weight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
  // Font family (can upgrade from system serif to a Google Font later)
  fontFamily: {
    serif: 'serif',
  },
  // Line heights
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;
