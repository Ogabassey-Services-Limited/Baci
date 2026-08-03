import { describe, expect, it } from 'vitest';
import {
  getInitialTemplateProfile,
  normalizeBusinessType,
} from '@/lib/initial-template-profiles';
import { curatedProfileCases } from './storefront-defaults/curated-profile-cases.test-support';

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

  it.each(
    curatedProfileCases
  )('exposes only neutral vocabulary and layout for $businessType', ({
    businessType,
    subject,
    shopNavLabel,
    contentOrder,
  }) => {
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
