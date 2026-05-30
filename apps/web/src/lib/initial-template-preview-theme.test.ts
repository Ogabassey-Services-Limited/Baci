import { describe, expect, it } from 'vitest';
import { deriveThemeFromColors } from '@/lib/initial-template-preview-theme';

describe('initial template preview theme helper', () => {
  it('derives the scoped theme values used by onboarding preview', () => {
    const theme = deriveThemeFromColors({
      primary: '#111111',
      background: '#FFFFFF',
      accent: '#F97316',
    });

    expect(theme.colors.primary).toBe('#111111');
    expect(theme.colors.header.background).toBe('#FFFFFF');
    expect(theme.colors.button.primary.text).toBe('#FFFFFF');
    expect(theme.spacing.header.height).toBe('4rem');
  });

  it('uses dark text for lowercase white brand colors', () => {
    const theme = deriveThemeFromColors({
      primary: '#ffffff',
      background: '#ffffff',
      accent: '#f97316',
    });

    expect(theme.colors.primary).toBe('#ffffff');
    expect(theme.colors.button.primary.text).toBe('#000000');
    expect(theme.spacing.header.height).toBe('4rem');
  });

  it('uses dark text for very light brand colors', () => {
    const theme = deriveThemeFromColors({
      primary: '#fbfbfb',
      background: '#FFFFFF',
      accent: '#f5f5f5',
    });

    expect(theme.colors.button.primary.text).toBe('#000000');
    expect(theme.colors.button.accent.text).toBe('#000000');
    expect(theme.spacing.header.height).toBe('4rem');
  });
});
