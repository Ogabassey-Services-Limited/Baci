import { describe, expect, it } from 'vitest';
import { buildFactualStorefrontDescription } from './build-factual-storefront-description';

describe('buildFactualStorefrontDescription', () => {
  it('prefers sanitized merchant-authored description then tagline', () => {
    expect(
      buildFactualStorefrontDescription({
        businessName: 'Zorvexa',
        siteDescription: '<strong>Curated linen essentials.</strong>',
        siteTagline: 'Ignored tagline',
        categoryName: null,
        country: 'NG',
      })
    ).toBe('Curated linen essentials.');
  });

  it('truncates an overlong authored description to the metadata limit', () => {
    const description = 'a'.repeat(161);

    const result = buildFactualStorefrontDescription({
      businessName: 'Zorvexa',
      siteDescription: description,
      siteTagline: 'Ignored tagline',
      categoryName: null,
      country: 'NG',
    });

    expect(result).toBe(`${'a'.repeat(157)}...`);
  });

  it('truncates an overlong authored tagline to the metadata limit', () => {
    const tagline = 'b'.repeat(161);

    const result = buildFactualStorefrontDescription({
      businessName: 'Zorvexa',
      siteDescription: '   ',
      siteTagline: tagline,
      categoryName: null,
      country: 'NG',
    });

    expect(result).toBe(`${'b'.repeat(157)}...`);
  });

  it('uses neutral factual fallback copy without unsupported commerce claims', () => {
    const description = buildFactualStorefrontDescription({
      businessName: 'Zorvexa',
      siteDescription: null,
      siteTagline: null,
      categoryName: 'Fashion',
      country: 'NG',
    });

    expect(description).toContain('Zorvexa');
    expect(description).toContain('Fashion');
    expect(description).not.toMatch(
      /nationwide delivery|flexible payments?|trusted quality|best seller|warranty/i
    );
  });
});
