/**
 * Ogabassey Design System
 * Aligned with Baci Web App design tokens
 * Primary: Red (#DC2626)
 *
 * 2026 Best Practice: WCAG AA Accessibility Compliance
 * - All text colors must meet 4.5:1 contrast ratio for normal text
 * - Large text (18pt+) requires 3:1 contrast ratio
 * - Interactive elements need distinct focus/hover states
 * - Color alone should not convey meaning (use icons/text too)
 */

import { Dimensions } from 'react-native';

// M28: Intentionally static — captured once at module load for the `clamp()` fluid
// typography helper below. This file is a constants module (not a component), so
// useWindowDimensions() is not applicable. Font sizes are computed once at startup;
// dynamic orientation changes do not require recalculating typography constants.
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Fluid Typography Helper (2025 Best Practice)
 * Replicates CSS clamp() logic for React Native
 * @param min - Minimum font size (px)
 * @param max - Maximum font size (px)
 * @param baseWidth - Base screen width for scaling (default: 375px)
 */
const clamp = (min: number, max: number, baseWidth: number = 375) => {
  const scaled = (SCREEN_WIDTH / baseWidth) * min;
  return Math.min(Math.max(scaled, min), max);
};

// ============================================
// DESIGN TOKENS (matching web app structure)
// ============================================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const RADIUS = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

export const SHADOWS = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

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

// ============================================
// COLOR PALETTE
// ============================================

const palette = {
  // Primary - Ogabassey Red
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },
  // Secondary - Amber/Gold (matching web accent)
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
  // Neutrals
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0A0A0A',
  },
  // Semantic colors
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#15803D',
    800: '#065F46',
    900: '#064E3B',
  },
  white: '#FFFFFF',
  black: '#000000',
};

export const SEMANTIC_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.5)',
  white: palette.white,
} as const;

/**
 * Applies alpha to supported color literals and returns `rgba(...)`.
 *
 * Supported inputs:
 * - 3-, 6-, or 8-digit hex strings, with or without a leading `#`
 * - comma-separated `rgb(r, g, b)` and `rgba(r, g, b, a)` values with integer
 *   RGB components from 0 to 255
 *
 * Limitations:
 * - Source alpha in 8-digit hex or `rgba()` is replaced by the provided alpha
 * - CSS named colors, HSL, percent RGB, and CSS Color 4 space/slash syntax are
 *   returned unchanged
 * - Alpha is clamped to the 0..1 range
 */
export function withAlpha(color: string, alpha: number): string {
  const normalizedAlpha = Math.min(Math.max(alpha, 0), 1);
  const hex = color.trim().replace(/^#/, '');

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = hex
      .split('')
      .map((value) => Number.parseInt(value + value, 16));
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  if (/^[0-9a-f]{6}$/i.test(hex) || /^[0-9a-f]{8}$/i.test(hex)) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
  }

  const rgbMatch = color.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i
  );
  if (rgbMatch) {
    const [r, g, b] = rgbMatch
      .slice(1, 4)
      .map((component) => Number.parseInt(component, 10));
    if ([r, g, b].every((component) => component >= 0 && component <= 255)) {
      return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
    }
  }

  return color;
}

// ============================================
// THEME COLORS (matching web app HSL structure)
// ============================================

const lightTheme = {
  // Core
  background: palette.white,
  foreground: palette.gray[900],
  card: palette.white,
  cardForeground: palette.gray[900],

  // Primary (red brand)
  primary: palette.red[600],
  primaryForeground: palette.white,

  // Secondary (amber accent - matching web)
  secondary: palette.amber[500],
  secondaryForeground: palette.black,

  // Accent
  accent: palette.amber[500],
  accentForeground: palette.black,

  // Muted (subtle backgrounds)
  muted: palette.gray[100],
  mutedForeground: palette.gray[500],

  // Borders & Input
  border: palette.gray[200],
  input: palette.gray[200],
  ring: palette.red[600],

  // Legacy compatibility - 2026 WCAG AA compliant values
  text: palette.gray[900], // Improved: darker for better contrast (was gray[800])
  textSecondary: palette.gray[600], // Improved: 4.5:1 contrast on white (was gray[500])
  placeholder: palette.gray[500], // Improved: visible placeholder text (was gray[100])
  tint: palette.red[600],
  icon: palette.gray[600], // Improved: better visibility (was gray[400])
  tabIconDefault: palette.gray[500], // Improved: better visibility (was gray[400])
  tabIconSelected: palette.red[600],

  // Semantic
  price: palette.red[600],
  rating: palette.amber[400],
  success: palette.emerald[500],
  warning: palette.amber[500],
  error: palette.red[500],
  destructive: palette.red[500],
  destructiveForeground: palette.white,
  selectedIconBackground: palette.red[50],
  promoBackground: palette.red[50],

  white: palette.white,
  black: palette.black,
};

export default {
  light: lightTheme,
  dark: {
    // Core - matching web dark theme structure
    background: palette.gray[950],
    foreground: palette.gray[50],
    card: '#1A1A1A',
    cardForeground: palette.gray[50],

    // Primary (amber in dark mode - matching web)
    primary: palette.amber[500],
    primaryForeground: palette.black,

    // Secondary
    secondary: palette.red[600],
    secondaryForeground: palette.white,

    // Accent
    accent: palette.amber[500],
    accentForeground: palette.black,

    // Muted
    muted: '#262626',
    mutedForeground: palette.gray[400],

    // Borders & Input
    border: palette.gray[800],
    input: palette.gray[800],
    ring: palette.amber[500],

    // Legacy compatibility - 2026 WCAG AA compliant values
    text: palette.gray[50],
    textSecondary: palette.gray[300], // Improved: 4.5:1 contrast on dark bg (was gray[400])
    placeholder: palette.gray[400], // Improved: visible placeholder text (was gray[900])
    tint: palette.amber[500],
    icon: palette.gray[400], // Improved: better visibility (was gray[500])
    tabIconDefault: palette.gray[400], // Improved: better visibility (was gray[500])
    tabIconSelected: palette.amber[500],

    // Semantic
    price: palette.red[400],
    rating: palette.amber[400],
    success: palette.emerald[400],
    warning: palette.amber[400],
    error: palette.red[400],
    destructive: palette.red[700],
    destructiveForeground: palette.gray[50],
    selectedIconBackground: 'rgba(239, 68, 68, 0.2)',
    promoBackground: 'rgba(239, 68, 68, 0.1)',

    white: palette.white,
    black: palette.black,
  },
  // RN 0.83: useColorScheme() can return 'unspecified' — treat as light
  unspecified: lightTheme,
};

// ============================================
// MOTION PHYSICS (2025 Elite Standard)
// ============================================

export const SPRING_CONFIG = {
  spring: {
    stiffness: 150,
    damping: 12,
    mass: 1,
  },
  snappy: {
    stiffness: 250,
    damping: 15,
    mass: 0.8,
  },
} as const;

// ============================================
// BRAND CONSTANTS
// ============================================

export const BRAND = {
  name: 'Ogabassey',
  primary: palette.red[600],
  onPrimary: palette.white,
  onSecondary: palette.black,
  primaryLight: palette.red[100],
  primaryDark: palette.red[700],
  secondary: palette.amber[500],
  tagline: 'Shop Phones & Tech',
};

// Re-export palette for direct access
export { palette };
