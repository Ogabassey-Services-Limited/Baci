import { describe, expect, it } from 'vitest';
import { generatedSEOContentSchema } from './generated-seo-content';

describe('generatedSEOContentSchema', () => {
  it('accepts a complete generated SEO response', () => {
    expect(
      generatedSEOContentSchema.safeParse({
        meta_title: 'Premium Leather Tote Bag for Nigeria',
        meta_description:
          'Shop this premium leather tote bag with trusted delivery throughout Nigeria. Order now for a durable, elegant work and travel essential.',
        keywords: ['leather tote', 'bags nigeria', 'premium bag'],
        focus_keyword: 'leather tote',
        suggestions: ['Include a delivery benefit in the copy'],
      }).success
    ).toBe(true);
  });

  it('rejects incomplete or malformed generated SEO responses', () => {
    expect(
      generatedSEOContentSchema.safeParse({
        meta_title: 'Premium Leather Tote Bag for Nigeria',
        meta_description: null,
        keywords: 'leather tote',
        focus_keyword: '',
      }).success
    ).toBe(false);
  });
});
