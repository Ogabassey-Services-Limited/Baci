import { describe, expect, it } from 'vitest';
import { normalizeOgabasseyBusinessType } from './ogabassey-entity';

describe('normalizeOgabasseyBusinessType', () => {
  it('normalizes OgaBassey away from stale fashion classification', () => {
    expect(
      normalizeOgabasseyBusinessType({
        business_type: 'fashion',
        custom_domain: 'ogabassey.com',
        slug: 'ogabassey',
      })
    ).toBe('electronics');
  });

  it('normalizes OgaBassey when only the slug matches', () => {
    expect(
      normalizeOgabasseyBusinessType({
        business_type: 'fashion',
        slug: 'OgaBassey',
      })
    ).toBe('electronics');
  });

  it('normalizes OgaBassey when only the custom domain matches', () => {
    expect(
      normalizeOgabasseyBusinessType({
        business_type: 'fashion',
        custom_domain: 'OGABASSEY.COM',
      })
    ).toBe('electronics');
  });

  it('preserves non-OgaBassey merchant business type', () => {
    expect(
      normalizeOgabasseyBusinessType({
        business_type: 'fashion',
        custom_domain: 'demo.example',
        slug: 'demo',
      })
    ).toBe('fashion');
  });

  it('falls back to general for blank or missing non-OgaBassey business type', () => {
    expect(
      normalizeOgabasseyBusinessType({
        business_type: '',
        custom_domain: null,
        slug: null,
      })
    ).toBe('general');
    expect(normalizeOgabasseyBusinessType({})).toBe('general');
  });
});
