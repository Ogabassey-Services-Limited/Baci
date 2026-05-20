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

import Colors from './themes';
import { palette, withAlpha } from './palette';

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
  // 6% alpha tint of primary — safe on any background (light & dark mode)
  primaryAlpha06: withAlpha(palette.red[600], 0.06),
  secondary: palette.amber[500],
  tagline: 'Shop Phones & Tech',
};

export { palette, SEMANTIC_COLORS, withAlpha } from './palette';
export { TYPOGRAPHY } from './typography';

export default Colors;
