import { getContrastingTextColor } from '@/lib/color-utils';
import type { ThemeConfiguration } from '@/lib/theme-config';
import type { BrandColors } from '@/types';

export function deriveCuratedTheme(colors: BrandColors): ThemeConfiguration {
  const primaryText = getContrastingTextColor(colors.primary);
  const accentText = getContrastingTextColor(colors.accent);
  return {
    colors: {
      primary: colors.primary,
      secondary: colors.secondary ?? colors.primary,
      accent: colors.accent,
      background: colors.background,
      foreground: getContrastingTextColor(colors.background),
      muted: '#F5F5F5',
      mutedForeground: '#666666',
      border: '#E0E0E0',
      header: {
        background: colors.background,
        text: getContrastingTextColor(colors.background),
        iconColor: colors.primary,
        searchBorder: colors.primary,
        searchBackground: '#FFFFFF',
      },
      footer: {
        background: colors.primary,
        text: primaryText,
        linkColor: primaryText,
        linkHoverColor: primaryText,
      },
      button: {
        primary: {
          background: colors.primary,
          text: primaryText,
          hover: colors.primary,
        },
        secondary: { background: '#F5F5F5', text: '#000000', hover: '#E0E0E0' },
        accent: {
          background: colors.accent,
          text: accentText,
          hover: colors.accent,
        },
      },
      card: { background: '#FFFFFF', border: '#E0E0E0', text: '#000000' },
      input: {
        background: '#FFFFFF',
        border: '#E0E0E0',
        text: '#000000',
        placeholder: '#999999',
        focusBorder: colors.primary,
      },
    },
  } as ThemeConfiguration;
}
