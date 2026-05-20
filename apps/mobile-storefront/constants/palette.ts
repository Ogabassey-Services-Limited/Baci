// ============================================
// COLOR PALETTE
// ============================================

export const palette = {
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
  surface: {
    darkCard: '#1A1A1A',
    darkMuted: '#262626',
  },
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

export const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.5)' as const;

export const SEMANTIC_COLORS = {
  overlay: OVERLAY_COLOR,
  white: palette.white,
} as const;

export { withAlpha } from './withAlpha';
