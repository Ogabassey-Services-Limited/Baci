import Colors from '@/constants/Colors';
import { palette, withAlpha } from '@/constants/palette';

export type CheckoutIdentityColorScheme = 'light' | 'dark';

export interface CheckoutIdentityTheme {
  accent: string;
  backdrop: string;
  border: string;
  buttonPrimary: string;
  buttonPrimaryPressed: string;
  card: string;
  cardSecondary: string;
  closeButton: string;
  divider: string;
  error: string;
  errorSurface: string;
  footer: string;
  footerText: string;
  handle: string;
  header: string;
  input: string;
  mutedText: string;
  placeholder: string;
  primary: string;
  primaryForeground: string;
  primarySubtle: string;
  sheet: string;
  text: string;
}

export function getCheckoutIdentityTheme(
  colorScheme: CheckoutIdentityColorScheme
): CheckoutIdentityTheme {
  const appTheme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const primary = appTheme.primary;
  const error = isDark ? palette.red[400] : palette.red[600];

  return {
    accent: appTheme.accent,
    backdrop: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.5)',
    border: appTheme.border,
    buttonPrimary: primary,
    buttonPrimaryPressed: isDark ? palette.amber[600] : palette.red[700],
    card: appTheme.card,
    cardSecondary: isDark ? appTheme.muted : appTheme.card,
    closeButton: appTheme.muted,
    divider: appTheme.border,
    error,
    errorSurface: withAlpha(error, isDark ? 0.18 : 0.1),
    footer: isDark ? appTheme.muted : palette.gray[50],
    footerText: appTheme.mutedForeground,
    handle: isDark ? palette.gray[700] : palette.gray[300],
    header: isDark ? appTheme.card : palette.gray[50],
    input: isDark ? appTheme.muted : appTheme.card,
    mutedText: appTheme.textSecondary,
    placeholder: appTheme.placeholder,
    primary,
    primaryForeground: appTheme.primaryForeground,
    primarySubtle: appTheme.primaryLowOpacity,
    sheet: appTheme.background,
    text: appTheme.text,
  };
}
