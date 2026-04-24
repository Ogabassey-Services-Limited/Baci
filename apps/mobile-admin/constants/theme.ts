/**
 * Baci Admin Theme - Supports Light & Dark Mode
 * Modern merchant dashboard UI with system theme switching
 */

// Dark Mode Colors
export const DARK_COLORS = {
  // Base colors
  background: '#0D0D1A',
  backgroundLight: '#12121F',
  card: '#1A1A2E',
  cardHover: '#252542',
  backdrop: 'rgba(0, 0, 0, 0.55)',
  border: '#2A2A40',
  inputBg: '#252542',

  // Text
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  placeholder: '#9CA3AF',

  // Brand - Blue Primary
  primary: '#4A90D9',
  primaryLight: 'rgba(74, 144, 217, 0.15)',
  textOnPrimary: '#FFFFFF',

  // Accent - Baci Gold
  gold: '#F0BF58',
  goldLight: 'rgba(240, 191, 88, 0.15)',
  orange: '#F59E0B',
  orangeLight: 'rgba(245, 158, 11, 0.15)',

  // Alias for main interactive color (blue)
  accent: '#4A90D9',
  accentLight: 'rgba(74, 144, 217, 0.15)',

  // Status
  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.15)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.15)',

  // Order status - aligned with web app
  pending: '#F59E0B',
  processing: '#3B82F6',
  shipped: '#8B5CF6',
  delivered: '#22C55E',
  cancelled: '#EF4444',
  returned: '#A855F7',

  // Misc
  live: '#22C55E',
  notification: '#EF4444',
  textOnNotification: '#FFFFFF',
};

// Light Mode Colors
export const LIGHT_COLORS = {
  // Base colors
  background: '#F8FAFC',
  backgroundLight: '#FFFFFF',
  card: '#FFFFFF',
  cardHover: '#F1F5F9',
  backdrop: 'rgba(15, 23, 42, 0.35)',
  border: '#E2E8F0',
  inputBg: '#F1F5F9',

  // Text
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  placeholder: '#475569',

  // Brand - Blue Primary
  primary: '#3B82F6',
  primaryLight: 'rgba(59, 130, 246, 0.1)',
  textOnPrimary: '#FFFFFF',

  // Accent - Baci Gold
  gold: '#D4A03D',
  goldLight: 'rgba(212, 160, 61, 0.12)',
  orange: '#EA580C',
  orangeLight: 'rgba(234, 88, 12, 0.1)',

  // Alias for main interactive color (blue)
  accent: '#3B82F6',
  accentLight: 'rgba(59, 130, 246, 0.1)',

  // Status
  success: '#16A34A',
  successLight: 'rgba(22, 163, 74, 0.1)',
  warning: '#CA8A04',
  warningLight: 'rgba(202, 138, 4, 0.1)',
  error: '#DC2626',
  errorLight: 'rgba(220, 38, 38, 0.1)',
  info: '#2563EB',
  infoLight: 'rgba(37, 99, 235, 0.1)',

  // Order status - aligned with web app
  pending: '#CA8A04',
  processing: '#2563EB',
  shipped: '#7C3AED',
  delivered: '#16A34A',
  cancelled: '#DC2626',
  returned: '#9333EA',

  // Misc
  live: '#16A34A',
  notification: '#DC2626',
  textOnNotification: '#FFFFFF',
};

// Default export for backwards compatibility (dark mode)
export const COLORS = { ...DARK_COLORS };
// AI UI accent colors for assistant-related chips, buttons, and highlights.
// Keep text white on the accent to maintain readable contrast on the purple fill.
export const AI_ACCENT_COLOR = '#8B5CF6';
export const AI_TEXT_COLOR = '#FFFFFF';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const TYPOGRAPHY = {
  // Font families (Inter)
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extraBold: 'Inter_800ExtraBold',
  },

  // Font sizes
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// Dynamic shadows based on theme
export const getShadows = (isDark: boolean) => ({
  sm: {
    shadowColor: isDark ? '#000' : '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.2 : 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: isDark ? '#000' : '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.25 : 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: isDark ? '#000' : '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
});

export type ThemeShadows = ReturnType<typeof getShadows>;

export const SHADOWS = getShadows(true);

// Chart colors (same for both themes)
export const CHART_COLORS = {
  profit: '#22C55E',
  revenue: '#F59E0B',
  gridLine: '#2A2A40',
};

export const getChartColors = (isDark: boolean) => ({
  profit: '#22C55E',
  revenue: '#F59E0B',
  gridLine: isDark ? '#2A2A40' : '#E2E8F0',
});

// Icon sizes
export const ICON_SIZE = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
};

// Type for colors
export type ThemeColors = typeof DARK_COLORS;
