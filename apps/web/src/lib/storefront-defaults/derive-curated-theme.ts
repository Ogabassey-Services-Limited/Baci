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
  const primaryText = contrastText(primary);
  const accentText = contrastText(accent);
  return {
    ...defaultTheme,
    colors: {
      primary,
      secondary,
      accent,
      background,
      foreground: contrastText(background),
      muted: '#F5F5F5',
      mutedForeground: '#666666',
      border: '#E0E0E0',
      header: {
        background,
        text: contrastText(background),
        iconColor: primary,
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
        secondary: { background: '#F5F5F5', text: '#000000', hover: '#E0E0E0' },
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
