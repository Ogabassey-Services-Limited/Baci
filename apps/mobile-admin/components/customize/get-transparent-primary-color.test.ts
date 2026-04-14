import { describe, expect, it } from 'vitest';
import { getTransparentPrimaryColor } from '@/components/customize/get-transparent-primary-color';

describe('getTransparentPrimaryColor', () => {
  it('prefers the provided primaryLight color', () => {
    expect(
      getTransparentPrimaryColor('rgba(59, 130, 246, 0.1)', '#3B82F6')
    ).toBe('rgba(59, 130, 246, 0.1)');
  });

  it('sanitizes unsupported primaryLight values', () => {
    expect(getTransparentPrimaryColor('url(javascript:1)', '#3B82F6')).toBe(
      'rgba(59, 130, 246, 0.125)'
    );
  });

  it('derives a safe translucent fallback from hex primary colors', () => {
    expect(getTransparentPrimaryColor(undefined, '#3B82F6')).toBe(
      'rgba(59, 130, 246, 0.125)'
    );
  });

  it('falls back safely when the primary color is unsupported', () => {
    expect(getTransparentPrimaryColor(undefined, 'url(javascript:1)')).toBe(
      'rgba(59, 130, 246, 0.125)'
    );
  });
});
