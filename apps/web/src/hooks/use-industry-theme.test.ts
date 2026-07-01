import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIndustryTheme } from './use-industry-theme';

describe('useIndustryTheme', () => {
  it('returns DEFAULT_THEME (ELECTRONICS) when businessType is undefined', () => {
    const { result } = renderHook(() => useIndustryTheme());
    expect(result.current.id).toBe('electronics');
    expect(result.current.vibe).toBe('Cyber/Tech');
  });

  it('returns DEFAULT_THEME (ELECTRONICS) when businessType is unknown', () => {
    const { result } = renderHook(() => useIndustryTheme('UNKNOWN_TYPE'));
    expect(result.current.id).toBe('electronics');
    expect(result.current.vibe).toBe('Cyber/Tech');
  });

  it('returns specific theme for valid businessType', () => {
    const { result } = renderHook(() => useIndustryTheme('FOOD_BEVERAGE'));
    expect(result.current.id).toBe('food-beverage');
    expect(result.current.vibe).toBe('Organic/Fresh');
    expect(result.current.colors.primary).toBe('#166534');
    expect(result.current.layout.hero).toBe('split');
  });

  it('returns specific theme for fashion merchants', () => {
    const { result } = renderHook(() => useIndustryTheme('FASHION'));
    expect(result.current.id).toBe('fashion');
    expect(result.current.vibe).toBe('Editorial');
  });

  it('returns specific theme for another valid businessType', () => {
    const { result } = renderHook(() => useIndustryTheme('HAIR_EXTENSIONS'));
    expect(result.current.id).toBe('hair-extensions');
    expect(result.current.vibe).toBe('Glamour');
    expect(result.current.colors.accent).toBe('#D4AF37');
  });
});
