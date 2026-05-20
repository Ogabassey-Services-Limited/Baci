import { palette, withAlpha } from './palette';

export const lightTheme = {
  // Core
  background: palette.white,
  foreground: palette.gray[900],
  card: palette.white,
  cardForeground: palette.gray[900],

  // Primary (red brand)
  primary: palette.red[600],
  primaryLowOpacity: withAlpha(palette.red[600], 0.08),
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

  // Legacy compatibility - text contrast is guarded by themes.test.ts
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
  selectedIconBackground: withAlpha(palette.red[500], 0.08),
  promoBackground: withAlpha(palette.red[500], 0.06),

  white: palette.white,
  black: palette.black,
};

export const darkTheme = {
  // Core - matching web dark theme structure
  background: palette.gray[950],
  foreground: palette.gray[50],
  card: palette.surface.darkCard,
  cardForeground: palette.gray[50],

  // Primary (amber in dark mode - matching web)
  primary: palette.amber[500],
  primaryLowOpacity: withAlpha(palette.amber[500], 0.14),
  primaryForeground: palette.black,

  // Secondary
  secondary: palette.red[600],
  secondaryForeground: palette.white,

  // Accent
  accent: palette.amber[500],
  accentForeground: palette.black,

  // Muted
  muted: palette.surface.darkMuted,
  mutedForeground: palette.gray[400],

  // Borders & Input
  border: palette.gray[800],
  input: palette.gray[800],
  ring: palette.amber[500],

  // Legacy compatibility - text contrast is guarded by themes.test.ts
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
  selectedIconBackground: withAlpha(palette.red[500], 0.2),
  promoBackground: withAlpha(palette.red[500], 0.1),

  white: palette.white,
  black: palette.black,
};

export default {
  light: lightTheme,
  dark: darkTheme,
  // RN 0.83: useColorScheme() can return 'unspecified' — treat as light
  unspecified: lightTheme,
};
