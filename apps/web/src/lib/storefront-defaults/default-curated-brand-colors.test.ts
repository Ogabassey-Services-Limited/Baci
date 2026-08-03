import { describe, expect, it } from 'vitest';
import { DEFAULT_CURATED_BRAND_COLORS } from './default-curated-brand-colors';

describe('DEFAULT_CURATED_BRAND_COLORS', () => {
  it('keeps the canonical fallback palette stable across onboarding clients', () => {
    expect(DEFAULT_CURATED_BRAND_COLORS).toEqual({
      primary: '#000000',
      background: '#ffffff',
      accent: '#F59E0B',
    });
  });
});
