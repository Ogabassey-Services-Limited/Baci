import { describe, expect, it } from 'vitest';
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
      }
    );
  });
});
