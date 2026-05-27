import { describe, expect, it } from 'vitest';
import {
  generateFeatures,
  generateHeroSlides,
} from '@/lib/initial-template-preview-content';

describe('initial template preview content helpers', () => {
  it('builds client-safe hero slides without server imports', async () => {
    const slides = await generateHeroSlides('CarePoint', 'pharmaceuticals');

    expect(slides[0]?.subtitle).toBe(
      'Trusted healthcare essentials and supplies.'
    );
    expect(slides[0]).toEqual(
      expect.objectContaining({
        image: expect.any(String),
        ctaText: 'Shop Now',
        ctaLink: '#products',
      })
    );
  });

  it('uses the same industry feature aliases as onboarding generation', () => {
    expect(generateFeatures('cosmetics')[0]?.title).toBe('Ingredient Focused');
    expect(generateFeatures('tech')[0]?.title).toBe('Official Warranty');
    expect(generateFeatures('unknown-type')[0]?.title).toBe('Fast Shipping');
  });
});
