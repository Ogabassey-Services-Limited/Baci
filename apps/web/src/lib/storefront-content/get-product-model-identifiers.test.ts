import { describe, expect, it } from 'vitest';
import { getProductModelIdentifiers } from './get-product-model-identifiers';

describe('getProductModelIdentifiers', () => {
  it('removes brand and category words while retaining model markers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Itel'],
      productSlugs: ['itel-power-80-128gb-4gb', 'itel-a06'],
    });

    expect(identifiers).toEqual(['power 80', 'a06']);
  });

  it('deduplicates identifiers across product variants', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Samsung'],
      productSlugs: [
        'samsung-galaxy-s25-128gb',
        'samsung-galaxy-s25-256gb',
        'samsung-galaxy-s24',
      ],
    });

    expect(identifiers).toEqual(['s25', 's24']);
  });

  it('removes configured brand aliases from nonnumeric model slugs', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Samsung'],
      productSlugs: ['samsung-galaxy-z-trifold'],
    });

    expect(identifiers).toEqual(['trifold']);
  });

  it('prefers a model code over dimensions, years, and capacities', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Apple'],
      productSlugs: ['macbook-air-13-inch-2022-m2-8gb-256gb'],
    });

    expect(identifiers).toEqual(['m2']);
  });

  it('retains a later numeric model code after a screen-size token', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productSlugs: ['dell-xps-13-9350'],
    });

    expect(identifiers).toEqual(['9350']);
  });

  it('keeps the laptop family and generation together', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['HP'],
      productSlugs: ['hp-probook-440-g8'],
    });

    expect(identifiers).toEqual(['probook 440 g8']);
  });

  it('preserves the family marker for numeric model generations', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Tecno'],
      productSlugs: ['tecno-spark-40'],
    });

    expect(identifiers).toEqual(['spark 40']);
  });

  it('derives brand aliases from compare slugs when brands are omitted', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      productSlugs: ['samsung-galaxy-z-trifold'],
    });

    expect(identifiers).toEqual(['trifold']);
  });

  it('retains complete product aliases in a VR comparison', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'vr-headsets',
      productSlugs: ['apple-vision-pro', 'meta-quest-3'],
    });

    expect(identifiers).toEqual(['vision pro', '3']);
  });

  it('preserves variant markers after numeric model generations', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Google'],
      productSlugs: ['google-pixel-9-pro'],
    });

    expect(identifiers).toEqual(['9 pro']);
  });

  it('retains alphanumeric model suffix markers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Samsung'],
      productSlugs: ['samsung-galaxy-s25-ultra-12gb-256gb'],
    });

    expect(identifiers).toEqual(['s25 ultra']);
  });

  it('removes merchandising suffixes from model identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productSlugs: ['iphone-13-pro-128gb-premium-used'],
    });

    expect(identifiers).toEqual(['13 pro']);
  });

  it('preserves configured model-family markers that overlap brand aliases', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Xiaomi and Redmi', 'xiaomi'],
      modelFamilySlug: 'redmi-15',
      productSlugs: ['redmi-15'],
    });

    expect(identifiers).toEqual(['redmi 15']);
  });

  it('ignores generated numeric collision suffixes', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productSlugs: ['apple-iphone-12-2'],
    });

    expect(identifiers).toEqual(['12']);
  });

  it('does not treat a singular category word as a model identifier', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Nothing'],
      productSlugs: ['nothing-phone'],
    });

    expect(identifiers).toEqual([]);
  });

  it('preserves a single-character model identifier', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'xbox',
      brands: ['Xbox'],
      productSlugs: ['xbox-series-x'],
    });

    expect(identifiers).toEqual(['x']);
  });

  it('returns an empty list when no brands or product slugs are supplied', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
    });

    expect(identifiers).toEqual([]);
  });
});
