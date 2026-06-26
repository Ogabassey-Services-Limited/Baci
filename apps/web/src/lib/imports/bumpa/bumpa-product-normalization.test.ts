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

  it('does not convert cellular generation labels into memory units', () => {
    expect(
      createBumpaProductProfile('iPhone 12 5G 128g').normalizedProductName
    ).toBe('iPhone 12 5G 128GB');
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
