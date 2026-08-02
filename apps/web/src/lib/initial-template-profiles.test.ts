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
    ['fashion-apparel', 'fashion'],
    ['tech', 'electronics'],
    ['health-beauty', 'beauty'],
    ['cosmetics', 'beauty'],
    ['hair-extensions', 'hair'],
    ['home-goods', 'home'],
    ['fashion_apparel', 'fashion'],
    ['handmade', 'art'],
    [null, ''],
    [undefined, ''],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeBusinessType(input)).toBe(expected);
  });

  it.each([
    ['Food-BEVERAGE', 'food'],
    ['  RESTAURANT  ', 'food'],
    ['', ''],
  ])('normalizes case and whitespace for %s', (input, expected) => {
    expect(normalizeBusinessType(input)).toBe(expected);
  });

  it.each([
    [
      'fashion',
      'styles',
      'Collections',
      ['hero', 'products', 'features', 'story', 'newsletter'],
    ],
    [
      'food',
      'menu items',
      'Menu',
      ['hero', 'products', 'story', 'features', 'newsletter'],
    ],
    [
      'electronics',
      'devices',
      'Gadgets',
      ['hero', 'features', 'products', 'story', 'newsletter'],
    ],
    [
      'pharmacy',
      'health products',
      'Health Store',
      ['hero', 'story', 'features', 'products', 'newsletter'],
    ],
    [
      'beauty',
      'beauty products',
      'Beauty Shop',
      ['hero', 'story', 'products', 'features', 'newsletter'],
    ],
    [
      'hair',
      'hair products',
      'Hair Store',
      ['hero', 'products', 'story', 'features', 'newsletter'],
    ],
    [
      'home',
      'home products',
      'Home Finds',
      ['hero', 'story', 'products', 'features', 'newsletter'],
    ],
    [
      'art',
      'handmade products',
      'Craft Shop',
      ['hero', 'story', 'products', 'features', 'newsletter'],
    ],
    [
      'handmade',
      'handmade products',
      'Craft Shop',
      ['hero', 'story', 'products', 'features', 'newsletter'],
    ],
    [
      'unknown-type',
      'products',
      'Shop',
      ['hero', 'story', 'features', 'products', 'newsletter'],
    ],
  ])('exposes only neutral vocabulary and layout for %s', (businessType, subject, shopNavLabel, contentOrder) => {
    expect(getInitialTemplateProfile(businessType)).toEqual({
      subject,
      shopNavLabel,
      storyAlign: expect.any(String),
      productGridColumns: expect.any(Number),
      productGridLimit: expect.any(Number),
      contentOrder,
    });
  });
});
