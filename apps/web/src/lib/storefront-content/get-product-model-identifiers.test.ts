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

  it('strips a leading Bluetooth descriptor while retaining the speaker model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'accessories',
      brands: ['JBL'],
      productNames: ['JBL Bluetooth Speaker Flip 6'],
    });

    expect(identifiers).toEqual(['flip 6']);
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

    expect(identifiers).toEqual(['vision pro', 'quest 3']);
  });

  it('preserves plus variants from product names instead of collision slugs', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Samsung'],
      productNames: ['Samsung Galaxy S24+'],
      productSlugs: ['samsung-galaxy-s24-2'],
    });

    expect(identifiers).toEqual(['s24 plus']);
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

  it('does not treat a leading Red Magic model token as merchandising', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Red Magic'],
      productSlugs: ['red-magic-10-pro'],
    });

    expect(identifiers).toEqual(['10 pro']);
  });

  it('retains AirPods in generation-only identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'audio',
      brands: ['Apple'],
      productSlugs: ['apple-airpods-2'],
    });

    expect(identifiers).toEqual(['airpods 2']);
  });

  it('removes a leading used condition without truncating the model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Sony'],
      productSlugs: ['used-xperia-1-vii'],
    });

    expect(identifiers).toEqual(['xperia 1 vii']);
  });

  it('keeps Ultra when it is a smartwatch model marker', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartwatches',
      brands: ['Apple'],
      productSlugs: ['apple-watch-ultra-2'],
    });

    expect(identifiers).toEqual(['watch ultra 2']);
  });

  it('retains model-family aliases in compound laptop identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Lenovo'],
      productSlugs: ['lenovo-legion-pro-9'],
    });

    expect(identifiers).toEqual(['legion pro 9']);
  });

  it('retains Dell family aliases that distinguish same-number models', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Dell'],
      productNames: ['Dell Latitude 5410', 'Dell Inspiron 14 5410'],
      productSlugs: [],
    });

    expect(identifiers).toEqual(['latitude 5410', 'inspiron 5410']);
  });

  it('removes optional Touch Bar suffixes from MacBook identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Apple'],
      productSlugs: ['13-macbook-pro-2022-m2-8gb-512gb-touch-bar'],
    });

    expect(identifiers).toEqual(['pro m2']);
  });

  it('removes standalone VRAM labels from MacBook identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'laptops',
      brands: ['Apple'],
      productSlugs: ['15-macbook-pro-2016-16gb-512gb-2gb-vram-i7-touchbar'],
    });

    expect(identifiers).toEqual(['pro 2016']);
  });

  it('removes NFID condition markers from iPhone identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productSlugs: ['iphone-x-3gb-64gb-nfid'],
    });

    expect(identifiers).toEqual(['x']);
  });

  it('ignores region suffixes before selecting a single-character model', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productSlugs: ['iphone-x-64gb-uk-used'],
    });

    expect(identifiers).toEqual(['x']);
  });

  it('removes optional connectivity suffixes from model identifiers', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Tecno'],
      productSlugs: ['tecno-spark-pro-dual-sim'],
    });

    expect(identifiers).toEqual(['spark pro']);
  });

  it('removes a compound connectivity marker run before sim', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Samsung'],
      productSlugs: ['samsung-galaxy-s22-ultra-12gb-256gb-dual-physical-sim'],
    });

    expect(identifiers).toEqual(['s22 ultra']);
  });

  it('removes a preceding physical marker from an esim suffix', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Apple'],
      productSlugs: ['iphone-16-pro-8gb-512gb-physical-esim-new'],
    });

    expect(identifiers).toEqual(['16 pro']);
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

  it('keeps Redmi as a discriminator on PDP and comparison contexts', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
      brands: ['Redmi'],
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

  it('preserves Xbox Series letter models as family phrases', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'xbox',
      brands: ['Xbox'],
      productSlugs: ['xbox-series-x', 'xbox-series-s'],
    });

    expect(identifiers).toEqual(['series x', 'series s']);
  });

  it('returns an empty list when no brands or product slugs are supplied', () => {
    const identifiers = getProductModelIdentifiers({
      categorySlug: 'smartphones',
    });

    expect(identifiers).toEqual([]);
  });
});
