import { describe, expect, it } from 'vitest';
import {
  generateFeatures,
  generateHeroSlides,
} from '@/lib/initial-template-generator';

describe('initial template fallback content', () => {
  it('uses food-specific hero copy for food-beverage merchants', async () => {
    const slides = await generateHeroSlides('Foodflow', 'food-beverage');

    expect(slides[0]?.subtitle).toBe('Fresh flavors and quality ingredients.');
    expect(slides[1]?.subtitle).toBe('Fresh ingredients, authentic recipes.');
  });

  it('uses pharmacy-specific hero copy for pharmaceuticals merchants', async () => {
    const slides = await generateHeroSlides('CarePoint', 'pharmaceuticals');

    expect(slides[0]?.subtitle).toBe(
      'Trusted healthcare essentials and supplies.'
    );
    expect(slides[1]?.subtitle).toBe(
      'Restock wellness products with confidence.'
    );
  });

  it('returns fallback hero slides for unknown business types', async () => {
    const slides = await generateHeroSlides('Fallback Store', 'unknown-type');

    expect(slides.length).toBeGreaterThan(0);
    for (const slide of slides) {
      expect(slide).toEqual(
        expect.objectContaining({
          title: expect.any(String),
          subtitle: expect.any(String),
          image: expect.any(String),
          ctaText: expect.any(String),
          ctaLink: expect.any(String),
        })
      );
    }
  });

  it('handles empty business names when generating hero slides', async () => {
    const slides = await generateHeroSlides('', 'handmade');

    expect(slides.length).toBeGreaterThan(0);
    expect(slides[0]?.title).toContain('Welcome');
  });

  it('uses handmade-specific hero copy beyond the first slide', async () => {
    const slides = await generateHeroSlides('Craft', 'handmade');

    expect(slides.length).toBeGreaterThanOrEqual(3);
    expect(slides[1].subtitle).toBe('Fresh artisan pieces from the maker.');
    expect(slides[2].subtitle).toBe(
      'Customer favorites with a personal touch.'
    );
  });

  it.each([
    ['health-beauty', 'Ingredient Focused'],
    ['hair-extensions', 'Premium Textures'],
    ['home-goods', 'Curated Style'],
    ['handmade', 'Unique Handmade'],
    ['art', 'Unique Handmade'],
    ['food-beverage', 'Fresh Ingredients'],
    ['pharmaceuticals', 'Trusted Products'],
  ])('uses industry-specific features for %s', (businessType, firstTitle) => {
    expect(generateFeatures(businessType)[0]?.title).toBe(firstTitle);
  });

  it('returns fallback features synchronously for unknown business types', () => {
    const features = generateFeatures('unknown-type');

    expect(features).not.toBeInstanceOf(Promise);
    expect(features.length).toBeGreaterThan(0);
    for (const feature of features) {
      expect(feature).toEqual(
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
          icon: expect.any(String),
        })
      );
    }
  });
});
