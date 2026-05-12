import { describe, expect, it } from 'vitest';
import {
  getInitialTemplateProfile,
  normalizeBusinessType,
} from '@/lib/initial-template-profiles';

describe('initial template profiles', () => {
  it.each([
    ['food-beverage', 'food'],
    ['restaurant', 'food'],
    ['pharmaceuticals', 'pharmacy'],
    ['health-beauty', 'beauty'],
    ['cosmetics', 'beauty'],
    ['hair-extensions', 'hair'],
    ['home-goods', 'home'],
    ['fashion_apparel', 'fashion'],
    ['fashion-apparel', 'fashion'],
    ['tech', 'electronics'],
  ])('normalizeBusinessType maps business type "%s" to template key "%s"', (input, expected) => {
    expect(normalizeBusinessType(input)).toBe(expected);
  });

  it.each([
    ['Food-BEVERAGE', 'food'],
    ['  RESTAURANT  ', 'food'],
    ['food@123', 'food@123'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('normalizes edge input %s to %s', (input, expected) => {
    expect(normalizeBusinessType(input)).toBe(expected);
  });

  it('uses a food starter profile optimized around menu ordering', () => {
    const profile = getInitialTemplateProfile('food-beverage');

    expect(profile.shopNavLabel).toBe('Menu');
    expect(profile.productGridTitle).toBe('Popular Dishes');
    expect(profile.productGridColumns).toBe(3);
    expect(profile.contentOrder.indexOf('products')).toBeLessThan(
      profile.contentOrder.indexOf('features')
    );
    expect(profile.newsletterTitle).toBe("Get today's specials");
  });

  it('uses a pharmacy starter profile distinct from food', () => {
    const profile = getInitialTemplateProfile('pharmaceuticals');

    expect(profile.shopNavLabel).toBe('Health Store');
    expect(profile.productGridTitle).toBe('Health Essentials');
    expect(profile.featuresTitle).toBe('Safe Healthcare Shopping');
    expect(profile.contentOrder.indexOf('features')).toBeLessThan(
      profile.contentOrder.indexOf('products')
    );
  });

  it.each([
    ['food', 'Menu', 'Popular Dishes'],
    ['pharmacy', 'Health Store', 'Health Essentials'],
    ['fashion', 'Collections', 'Latest Drops'],
    ['electronics', 'Gadgets', 'Featured Gadgets'],
    ['beauty', 'Beauty Shop', 'Beauty Essentials'],
    ['hair', 'Hair Store', 'Popular Hair Picks'],
    ['home', 'Home Finds', 'Curated Home Finds'],
    ['handmade', 'Craft Shop', 'Handmade Favorites'],
    ['art', 'Craft Shop', 'Handmade Favorites'],
    ['unknown-type', 'Shop', 'Our Products'],
    ['', 'Shop', 'Our Products'],
  ])('returns a complete profile for %s', (businessType, nav, gridTitle) => {
    const profile = getInitialTemplateProfile(businessType);

    expect(profile).toEqual(
      expect.objectContaining({
        shopNavLabel: nav,
        storyTitle: expect.any(String),
        storyContent: expect.any(String),
        featuresTitle: expect.any(String),
        productGridTitle: gridTitle,
        productGridColumns: expect.any(Number),
        productGridLimit: expect.any(Number),
        newsletterTitle: expect.any(String),
        newsletterDescription: expect.any(String),
        contentOrder: expect.arrayContaining(['hero', 'products']),
      })
    );
  });

  it('returns the default profile for null and undefined business types', () => {
    const nullProfile = getInitialTemplateProfile(null);
    const undefinedProfile = getInitialTemplateProfile(undefined);

    expect(nullProfile.shopNavLabel).toBe('Shop');
    expect(nullProfile.contentOrder).toContain('story');
    expect(undefinedProfile.productGridTitle).toBe('Our Products');
  });
});
