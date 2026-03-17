import { getProductSlugFallbackCandidates } from './product-slug-fallback';

describe('getProductSlugFallbackCandidates', () => {
  it('strips legacy condition and storage suffixes to reach the parent slug', () => {
    expect(
      getProductSlugFallbackCandidates('iphone-13-pro-128gb-premium-used')
    ).toEqual(['iphone-13-pro-128gb', 'iphone-13-pro']);
  });

  it('strips stacked ram, storage, and condition suffixes in order', () => {
    expect(
      getProductSlugFallbackCandidates('iphone-13-pro-6gb-128gb-new-open-box')
    ).toEqual([
      'iphone-13-pro-6gb-128gb',
      'iphone-13-pro-6gb',
      'iphone-13-pro',
    ]);
  });

  it('returns an empty list for a canonical parent slug', () => {
    expect(getProductSlugFallbackCandidates('iphone-13-pro')).toEqual([]);
  });

  it('normalizes uppercase slugs before generating fallback candidates', () => {
    expect(
      getProductSlugFallbackCandidates('IPHONE-13-PRO-128GB-USED')
    ).toEqual(['iphone-13-pro-128gb', 'iphone-13-pro']);
  });

  it('returns an empty list for empty or whitespace-only input', () => {
    expect(getProductSlugFallbackCandidates('')).toEqual([]);
    expect(getProductSlugFallbackCandidates('   ')).toEqual([]);
  });
});
