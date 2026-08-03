import { describe, expect, it } from 'vitest';
import { hexToHslComponents } from '@/lib/color-utils';
import { getCuratedThemeTokenProjection } from './curated-theme-token-projection';
import { deriveCuratedTheme } from './derive-curated-theme';

describe('getCuratedThemeTokenProjection', () => {
  it('projects the complete scoped theme, store, core, and destructive pairs', () => {
    const theme = deriveCuratedTheme({
      primary: '#ffffff',
      secondary: '#123456',
      background: '#000000',
      accent: '#777777',
    });

    const tokens = getCuratedThemeTokenProjection(theme);

    expect(tokens).toMatchObject({
      '--theme-header-bg': theme.colors.header.background,
      '--theme-header-text': theme.colors.header.text,
      '--theme-font-heading': theme.typography.fontFamily.heading,
      '--theme-radius-full': theme.borders.radius.full,
      '--store-background': theme.colors.background,
      '--store-background-text': theme.colors.foreground,
      '--store-secondary': theme.colors.button.secondary.background,
      '--background': hexToHslComponents(theme.colors.background),
      '--foreground': hexToHslComponents(theme.colors.foreground),
      '--secondary': hexToHslComponents(
        theme.colors.button.secondary.background
      ),
      '--secondary-foreground': hexToHslComponents(
        theme.colors.button.secondary.text
      ),
      '--destructive': hexToHslComponents('#B91C1C'),
      '--destructive-foreground': hexToHslComponents('#FFFFFF'),
    });
  });
});
