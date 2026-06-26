import { describe, expect, it } from 'vitest';
import { createBumpaProductProfile } from './bumpa-product-normalization';

describe('createBumpaProductProfile', () => {
  it('normalizes bracketed conditions and labeled identifiers', () => {
    const profile = createBumpaProductProfile(
      'iPhone 12 128gb (premium Used) IMEI: 351183326811261'
    );

    expect(profile.normalizedProductName).toBe(
      'iPhone 12 128GB (Premium Used)'
    );
    expect(profile.condition).toBe('Premium Used');
    expect(profile.conditionSource).toBe('bracketed');
    expect(profile.identifiers.imeis).toEqual(['351183326811261']);
    expect(profile.analyticsProductKey).toBe('iphone-12-128gb-premium-used');
  });

  it('normalizes plain conditions', () => {
    const profile = createBumpaProductProfile('iPhone 12 128gb Premium Used');

    expect(profile.normalizedProductName).toBe(
      'iPhone 12 128GB (Premium Used)'
    );
    expect(profile.conditionSource).toBe('plain');
  });

  it('preserves non-condition bracket notes while extracting mixed condition groups', () => {
    expect(
      createBumpaProductProfile('HP EliteBook [New Screen]')
        .normalizedProductName
    ).toBe('HP EliteBook [New Screen]');
    expect(
      createBumpaProductProfile('iPhone 12 (UK Used 128gb)')
        .normalizedProductName
    ).toBe('iPhone 12 128GB (UK Used)');
    expect(
      createBumpaProductProfile('iPhone 12 (Brand New Open Box)')
        .normalizedProductName
    ).toBe('iPhone 12 (Open Box)');
  });

  it('keeps contact-only names out of normalized analytics fields', () => {
    const profile = createBumpaProductProfile('+2348012345678');

    expect(profile.normalizedProductName).toBe('Unidentified Product');
    expect(profile.analyticsProductKey).toBe('unidentified-product');
  });

  it('strips formatted phone numbers from normalized analytics fields', () => {
    const spaced = createBumpaProductProfile('iPhone 12 0801 234 5678');
    const dashed = createBumpaProductProfile('iPhone 13 0801-234-5678');
    const dotted = createBumpaProductProfile('iPhone 14 0801.234.5678');
    const countryCode = createBumpaProductProfile(
      'iPhone 15 +234 801 234 5678'
    );
    const dashedCountryCode = createBumpaProductProfile(
      'iPhone 16 +234-801-234-5678'
    );
    const dottedCountryCode = createBumpaProductProfile(
      'iPhone 17 +234.801.234.5678'
    );
    const otherPrefix = createBumpaProductProfile('iPhone 18 0803 234 5678');
    const otherCountryCodePrefix = createBumpaProductProfile(
      'iPhone 19 +234 813 234 5678'
    );

    expect(spaced.normalizedProductName).toBe('iPhone 12');
    expect(spaced.analyticsProductKey).toBe('iphone-12');
    expect(dashed.normalizedProductName).toBe('iPhone 13');
    expect(dashed.analyticsProductKey).toBe('iphone-13');
    expect(dotted.normalizedProductName).toBe('iPhone 14');
    expect(dotted.analyticsProductKey).toBe('iphone-14');
    expect(countryCode.normalizedProductName).toBe('iPhone 15');
    expect(countryCode.analyticsProductKey).toBe('iphone-15');
    expect(dashedCountryCode.normalizedProductName).toBe('iPhone 16');
    expect(dashedCountryCode.analyticsProductKey).toBe('iphone-16');
    expect(dottedCountryCode.normalizedProductName).toBe('iPhone 17');
    expect(dottedCountryCode.analyticsProductKey).toBe('iphone-17');
    expect(otherPrefix.normalizedProductName).toBe('iPhone 18');
    expect(otherPrefix.analyticsProductKey).toBe('iphone-18');
    expect(otherCountryCodePrefix.normalizedProductName).toBe('iPhone 19');
    expect(otherCountryCodePrefix.analyticsProductKey).toBe('iphone-19');
  });

  it('does not convert cellular generation labels into memory units', () => {
    expect(
      createBumpaProductProfile('iPhone 12 5G 128g').normalizedProductName
    ).toBe('iPhone 12 5G 128GB');
  });

  it('preserves gram weights for non-electronics products', () => {
    const profile = createBumpaProductProfile('Shea Butter 250g');

    expect(profile.normalizedProductName).toBe('Shea Butter 250g');
    expect(profile.analyticsProductKey).toBe('shea-butter-250g');
  });

  it('preserves iPhone XS Max casing', () => {
    expect(
      createBumpaProductProfile('iPhone xs max 64gb').normalizedProductName
    ).toBe('iPhone XS Max 64GB');
  });

  it('distinguishes Redmi from broader Xiaomi devices', () => {
    expect(createBumpaProductProfile('Redmi Note 13').family).toBe('Redmi');
    expect(createBumpaProductProfile('Xiaomi 14').family).toBe('Xiaomi');
  });
});
