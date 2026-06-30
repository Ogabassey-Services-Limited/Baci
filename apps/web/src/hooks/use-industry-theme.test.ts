import { describe, expect, it } from 'vitest';
import { useIndustryTheme } from './use-industry-theme';

describe('useIndustryTheme', () => {
  it('returns the default theme (ELECTRONICS) when no businessType is provided', () => {
    const theme = useIndustryTheme();
    expect(theme.id).toBe('electronics');
    expect(theme.vibe).toBe('Cyber/Tech');
  });

  it('returns the default theme when an unknown businessType is provided', () => {
    const theme = useIndustryTheme('UNKNOWN_INDUSTRY');
    expect(theme.id).toBe('electronics');
  });

  it('returns the correct theme for a known businessType (FOOD_BEVERAGE)', () => {
    const theme = useIndustryTheme('FOOD_BEVERAGE');
    expect(theme.id).toBe('food-beverage');
    expect(theme.vibe).toBe('Organic/Fresh');
    expect(theme.colors.primary).toBe('#166534');
  });

  it('returns the correct theme for another known businessType (FASHION)', () => {
    const theme = useIndustryTheme('FASHION');
    expect(theme.id).toBe('fashion');
    expect(theme.vibe).toBe('Editorial');
  });
});
