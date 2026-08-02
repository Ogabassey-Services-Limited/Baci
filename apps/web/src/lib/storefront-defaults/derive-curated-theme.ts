import { colord } from 'colord';
import { getContrastRatio } from '@/lib/color-utils';
import { normalizeBusinessType } from '@/lib/initial-template-profiles';
import { defaultTheme, type ThemeConfiguration } from '@/lib/theme-config';
import type { BrandColors } from '@/types';

const categoryRadius: Record<string, string> = {
  fashion: '1rem',
  food: '0.75rem',
  electronics: '0.25rem',
  pharmacy: '0.5rem',
};

export function deriveCuratedTheme(
  colors: BrandColors,
  businessType = 'other'
): ThemeConfiguration {
  const category = normalizeBusinessType(businessType);
  const primary = colord(colors.primary).toHex();
  const secondary = colord(colors.secondary ?? colors.primary).toHex();
  const accent = colord(colors.accent).toHex();
  const background = colord(colors.background).toHex();
  const contrastText = (background: string) =>
    getContrastRatio(background, '#000000') >=
    getContrastRatio(background, '#FFFFFF')
      ? '#000000'
      : '#FFFFFF';
  const foreground = contrastText(background);
  const primaryText = contrastText(primary);
  const secondaryText = contrastText(secondary);
  const accentText = contrastText(accent);
  const muted = '#F5F5F5';
  const mutedForeground = contrastText(muted);
  return {
    ...defaultTheme,
    colors: {
      primary,
      secondary,
      accent,
      background,
      foreground,
      muted,
      mutedForeground,
      border: '#E0E0E0',
      header: {
        background,
        text: foreground,
        iconColor: foreground,
        searchBorder: primary,
        searchBackground: '#FFFFFF',
      },
      footer: {
        background: primary,
        text: primaryText,
        linkColor: primaryText,
        linkHoverColor: primaryText,
      },
      button: {
        primary: {
          background: primary,
          text: primaryText,
          hover: primary,
        },
        secondary: {
          background: secondary,
          text: secondaryText,
          hover: secondary,
        },
        accent: {
          background: accent,
          text: accentText,
          hover: accent,
        },
      },
      card: { background: '#FFFFFF', border: '#E0E0E0', text: '#000000' },
      input: {
        background: '#FFFFFF',
        border: '#E0E0E0',
        text: '#000000',
        placeholder: '#999999',
        focusBorder: primary,
      },
    },
    borders: {
      ...defaultTheme.borders,
      radius: {
        ...defaultTheme.borders.radius,
        lg: categoryRadius[category] ?? '0.625rem',
      },
    },
  };
}
