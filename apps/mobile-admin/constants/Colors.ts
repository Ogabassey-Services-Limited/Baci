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
    400: '#34D399',
    500: '#10B981',
  },
  blue: {
    500: '#3B82F6',
  },
  white: '#FFFFFF',
  black: '#000000',
};

// ============================================
// BRAND CONSTANTS
// ============================================

export const BRAND = {
  name: 'Ogabassey',
  primary: palette.red[600],
  primaryLight: palette.red[100],
  primaryDark: palette.red[700],
  secondary: palette.amber[500],
  tagline: 'Shop Phones & Tech',
};

// Re-export palette for direct access
export { palette };
