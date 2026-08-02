import { describe, expect, it } from 'vitest';
import { hexToHslComponents } from '@/lib/color-utils';
import { deriveCuratedTheme } from '@/lib/storefront-defaults/derive-curated-theme';
import { getOnboardingPreviewThemeStyles } from './onboarding-preview-theme-styles';

describe('getOnboardingPreviewThemeStyles', () => {
  it.each([
    {
      colors: { primary: '#ffffff', background: '#000000', accent: '#ff0000' },
      businessType: 'fashion',
    },
    {
      colors: { primary: '#000000', background: '#ffffff', accent: '#00ff00' },
      businessType: 'fashion',
    },
    {
      colors: { primary: '#111111', background: '#fefefe', accent: '#336699' },
      businessType: 'other',
    },
    {
      colors: {
        primary: '#ffffff',
        secondary: '#123456',
        background: '#000000',
        accent: '#777777',
      },
      businessType: 'fashion',
    },
  ])('maps Builder-consumed foreground and background tokens for $businessType', ({
    colors,
    businessType,
  }) => {
    const theme = deriveCuratedTheme(colors, businessType);

    expect(getOnboardingPreviewThemeStyles(colors, businessType)).toMatchObject(
      {
        backgroundColor: 'var(--theme-background)',
        color: 'var(--theme-foreground)',
        '--theme-background': theme.colors.background,
        '--theme-foreground': theme.colors.foreground,
        '--store-background': theme.colors.background,
        '--store-background-text': theme.colors.foreground,
        '--background': hexToHslComponents(theme.colors.background),
        '--foreground': hexToHslComponents(theme.colors.foreground),
        '--primary': hexToHslComponents(theme.colors.primary),
        '--primary-foreground': hexToHslComponents(
          theme.colors.button.primary.text
        ),
        '--theme-secondary': theme.colors.secondary,
        '--secondary': hexToHslComponents(
          theme.colors.button.secondary.background
        ),
        '--secondary-foreground': hexToHslComponents(
          theme.colors.button.secondary.text
        ),
        '--card': hexToHslComponents(theme.colors.card.background),
        '--card-foreground': hexToHslComponents(theme.colors.card.text),
        '--muted-foreground': hexToHslComponents(theme.colors.mutedForeground),
      }
    );
  });
});
