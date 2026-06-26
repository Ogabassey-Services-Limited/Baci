import { describe, expect, it } from 'vitest';
import { buildBumpaItemImportMetadata } from './build-bumpa-item-import-metadata';

describe('buildBumpaItemImportMetadata', () => {
  it('builds analytics metadata from a rich Bumpa item name', () => {
    const metadata = buildBumpaItemImportMetadata(
      'Pixel 7a 128gb (Premium Used) IMEI: 351183326811261'
    );

    expect(metadata).toEqual({
      raw_product_name: 'Pixel 7a 128gb (Premium Used) IMEI: 351183326811261',
      normalized_product_name: 'Google Pixel 7a 128GB (Premium Used)',
      analytics_product_key: 'google-pixel-7a-128gb-premium-used',
      product_kind: 'device',
      brand: 'Google',
      product_family: 'Google Pixel',
      condition: 'Premium Used',
      condition_source: 'bracketed',
      fulfillment_identifiers: {
        imeis: ['351183326811261'],
        serialNumbers: [],
        unlabeledIdentifiers: [],
      },
    });
  });

  it('extracts actual serials from Serial Number labels', () => {
    const metadata = buildBumpaItemImportMetadata(
      'MacBook Air M1 8gb 256gb Serial Number: C02GR0WHQ05N'
    );

    expect(metadata.normalized_product_name).toBe('MacBook Air M1 8GB 256GB');
    expect(metadata.fulfillment_identifiers.serialNumbers).toEqual([
      'C02GR0WHQ05N',
    ]);
  });

  it('keeps fallback metadata stable for blank names', () => {
    const metadata = buildBumpaItemImportMetadata('');

    expect(metadata).toMatchObject({
      raw_product_name: '',
      normalized_product_name: 'Unidentified Product',
      analytics_product_key: 'unidentified-product',
      brand: null,
      product_family: null,
      condition: null,
      condition_source: null,
      fulfillment_identifiers: {
        imeis: [],
        serialNumbers: [],
        unlabeledIdentifiers: [],
      },
    });
  });

  it('redacts contact details from raw product names while keeping identifiers', () => {
    const metadata = buildBumpaItemImportMetadata(
      'iPhone 12 ada@example.com +234 801 234 5678 IMEI: 351183326811261'
    );

    expect(metadata.raw_product_name).toBe(
      'iPhone 12 [redacted-email] [redacted-phone] IMEI: 351183326811261'
    );
    expect(metadata.fulfillment_identifiers.imeis).toEqual(['351183326811261']);

    const otherPrefixMetadata = buildBumpaItemImportMetadata(
      'iPhone 13 0803-234-5678'
    );

    expect(otherPrefixMetadata.raw_product_name).toBe(
      'iPhone 13 [redacted-phone]'
    );
  });
});
