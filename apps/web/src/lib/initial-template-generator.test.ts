import { generateObject } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateFeatures,
  generateHeroSlides,
  generateInitialTemplate,
} from '@/lib/initial-template-generator';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@/ai/provider', () => ({
  activeTextModel: 'test-model',
}));

const generatedAiContent = {
  object: {
    hero: [
      { title: 'AI hero 1', subtitle: 'AI subtitle 1' },
      { title: 'AI hero 2', subtitle: 'AI subtitle 2' },
      { title: 'AI hero 3', subtitle: 'AI subtitle 3' },
    ],
    features: [
      {
        title: 'AI feature 1',
        description: 'AI description 1',
        icon: 'star',
      },
      {
        title: 'AI feature 2',
        description: 'AI description 2',
        icon: 'truck',
      },
      {
        title: 'AI feature 3',
        description: 'AI description 3',
        icon: 'shield-check',
      },
    ],
  },
};

describe('initial template fallback content', () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
    vi.mocked(generateObject).mockResolvedValue(
      generatedAiContent as Awaited<ReturnType<typeof generateObject>>
    );
  });

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
    // Aliases handled by `normalizeBusinessType` — guard against regressions
    // when the source alias map changes.
    ['cosmetics', 'Ingredient Focused'],
    ['restaurant', 'Fresh Ingredients'],
    ['fashion_apparel', 'Premium Quality'],
    ['tech', 'Official Warranty'],
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

  it('builds Puck content using the selected industry profile', async () => {
    const config = await generateInitialTemplate({
      businessName: 'Foodflow',
      businessType: 'food-beverage',
      brandColors: {
        primary: '#14532d',
        background: '#fff7ed',
        accent: '#f97316',
      },
      merchant: {
        logo_url: 'https://example.com/logo.png',
      },
    });

    const header = config.content.find((block) => block.type === 'Header');
    const text = config.content.find((block) => block.type === 'Text');
    const productGridIndex = config.content.findIndex(
      (block) => block.type === 'ProductGrid'
    );
    const featuresIndex = config.content.findIndex(
      (block) => block.type === 'Features'
    );
    const productGrid = config.content[productGridIndex];
    const newsletter = config.content.find(
      (block) => block.type === 'Newsletter'
    );

    expect(header?.props?.navigationLinks).toContainEqual({
      label: 'Menu',
      url: '/products',
    });
    expect(text?.props?.title).toBe('Fresh meals, simple ordering');
    // Food storefronts are menu-first, so products should appear before trust
    // features to match ordering-focused browsing.
    expect(productGridIndex).toBeLessThan(featuresIndex);
    expect(productGrid?.props?.title).toBe('Popular Dishes');
    expect(productGrid?.props?.columns).toBe(3);
    expect(newsletter?.props?.title).toBe("Get today's specials");
  });

  it('returns default profile content for unknown initial template business types', async () => {
    const config = await generateInitialTemplate({
      businessName: 'Fallback Store',
      businessType: 'unknown-type',
      brandColors: {
        primary: '#111111',
        background: '#ffffff',
        accent: '#f97316',
      },
      merchant: {},
    });

    const header = config.content.find((block) => block.type === 'Header');
    const productGrid = config.content.find(
      (block) => block.type === 'ProductGrid'
    );

    expect(header?.props?.navigationLinks).toContainEqual({
      label: 'Shop',
      url: '/products',
    });
    expect(productGrid?.props?.title).toBe('Our Products');
  });

  it('falls back to static content when AI content generation fails', async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error('ai down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Expected in this regression test.
    });

    const config = await generateInitialTemplate({
      businessName: 'CarePoint',
      businessType: 'pharmaceuticals',
      brandColors: {
        primary: '#0f766e',
        background: '#ffffff',
        accent: '#22c55e',
      },
      merchant: {
        // Runtime merchant data is not guaranteed to be clean; non-string logos
        // must be ignored rather than passed through to the storefront header.
        logo_url: 42,
      },
    });

    const hero = config.content.find((block) => block.type === 'HeroCarousel');
    const header = config.content.find((block) => block.type === 'Header');
    const features = config.content.find((block) => block.type === 'Features');
    const productGrid = config.content.find(
      (block) => block.type === 'ProductGrid'
    );
    const firstSlide = hero?.props?.slides?.[0];

    expect(firstSlide?.subtitle).toBe(
      'Trusted healthcare essentials and supplies.'
    );
    expect(features?.props?.title).toBe('Safe Healthcare Shopping');
    expect(productGrid?.props?.title).toBe('Health Essentials');
    expect(header?.props?.logoUrl).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'AI Content Generation Failed:',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
