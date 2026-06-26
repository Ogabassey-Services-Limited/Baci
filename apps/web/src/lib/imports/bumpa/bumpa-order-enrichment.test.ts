import { describe, expect, it } from 'vitest';
import {
  buildBumpaItemImportMetadata,
  buildBumpaShippingAddress,
  enrichBumpaOrderItems,
} from './bumpa-order-enrichment';

describe('buildBumpaItemImportMetadata', () => {
  it('keeps IMEI as fulfillment data while normalizing the product profile', () => {
    const metadata = buildBumpaItemImportMetadata(
      'iPhone 12 128gb (premium Used) IMEI: 351183326811261'
    );

    expect(metadata.normalized_product_name).toBe(
      'iPhone 12 128GB (Premium Used)'
    );
    expect(metadata.analytics_product_key).toBe('iphone-12-128gb-premium-used');
    expect(metadata.condition).toBe('Premium Used');
    expect(metadata.condition_source).toBe('bracketed');
    expect(metadata.fulfillment_identifiers.imeis).toEqual(['351183326811261']);
  });

  it('marks non-bracketed condition text as plain', () => {
    const metadata = buildBumpaItemImportMetadata(
      'iPhone 12 128gb Premium Used'
    );

    expect(metadata.condition).toBe('Premium Used');
    expect(metadata.condition_source).toBe('plain');
  });

  it('normalizes Pixel to Google Pixel for analytics grouping', () => {
    const metadata = buildBumpaItemImportMetadata(
      'Pixel 7a 128gb (Premium Used)'
    );

    expect(metadata.normalized_product_name).toBe(
      'Google Pixel 7a 128GB (Premium Used)'
    );
    expect(metadata.brand).toBe('Google');
    expect(metadata.product_family).toBe('Google Pixel');
  });

  it('does not strip condition words inside larger product terms', () => {
    const metadata = buildBumpaItemImportMetadata('Renewed iPhone 12 128gb');

    expect(metadata.normalized_product_name).toBe('Renewed iPhone 12 128GB');
  });

  it('extracts serial numbers without dropping the raw product name', () => {
    const metadata = buildBumpaItemImportMetadata(
      '16" MacBook Pro M1 16gb 512gb (premium Used) S/N: C02GR0WHQ05N'
    );

    expect(metadata.raw_product_name).toContain('S/N: C02GR0WHQ05N');
    expect(metadata.normalized_product_name).toBe(
      '16" MacBook Pro M1 16GB 512GB (Premium Used)'
    );
    expect(metadata.fulfillment_identifiers.serialNumbers).toEqual([
      'C02GR0WHQ05N',
    ]);
  });

  it('classifies non-device fees separately from product analytics', () => {
    expect(buildBumpaItemImportMetadata('Delivery').product_kind).toBe(
      'delivery_fee'
    );
    expect(buildBumpaItemImportMetadata('Vat').product_kind).toBe('tax_fee');
    expect(buildBumpaItemImportMetadata('Insurance').product_kind).toBe(
      'protection'
    );
  });

  it('keeps numeric serial numbers out of imeis when an IMEI is also present', () => {
    const metadata = buildBumpaItemImportMetadata(
      'iPhone 12 IMEI: 351183326811261 S/N: 123456789012345'
    );

    expect(metadata.fulfillment_identifiers.imeis).toEqual(['351183326811261']);
    expect(metadata.fulfillment_identifiers.serialNumbers).toEqual([
      '123456789012345',
    ]);
    expect(metadata.fulfillment_identifiers.unlabeledIdentifiers).toEqual([]);
  });
});

describe('enrichBumpaOrderItems', () => {
  it('adds Bumpa metadata to each normalized imported order item', () => {
    const [item] = enrichBumpaOrderItems([
      {
        productId: null,
        productName: 'Samsung S23 256gb (Open Box)',
        sku: null,
        quantity: 1,
        unitPrice: 500000,
        lineTotal: 500000,
        matched: false,
        matchSource: 'unmatched',
      },
    ]);

    expect(item.importMetadata?.bumpa).toMatchObject({
      normalized_product_name: 'Samsung S23 256GB (Open Box)',
      product_kind: 'device',
      brand: 'Samsung',
    });
  });

  it('preserves existing import metadata while adding Bumpa metadata', () => {
    const [item] = enrichBumpaOrderItems([
      {
        productId: null,
        productName: 'Samsung S23 256gb (Open Box)',
        sku: null,
        quantity: 1,
        unitPrice: 500000,
        lineTotal: 500000,
        matched: false,
        matchSource: 'unmatched',
        importMetadata: { upstream: { matchedBy: 'sku' } },
      },
    ]);

    expect(item.importMetadata).toMatchObject({
      upstream: { matchedBy: 'sku' },
      bumpa: {
        normalized_product_name: 'Samsung S23 256GB (Open Box)',
      },
    });
  });
});

describe('buildBumpaShippingAddress', () => {
  it('builds a shipping address from the rich import columns', () => {
    expect(
      buildBumpaShippingAddress({
        best_address_full: '10 Marina, Lagos, Nigeria',
        best_address_street: '10 Marina',
        best_address_city: 'Marina',
        best_address_state: 'Lagos',
        best_address_country: 'Nigeria',
        best_address_zip: '100001',
        address_source: 'shipping',
      })
    ).toEqual({
      fullAddress: '10 Marina, Lagos, Nigeria',
      address: '10 Marina',
      city: 'Marina',
      state: 'Lagos',
      country: 'Nigeria',
      postalCode: '100001',
      source: 'shipping',
    });
  });

  it('falls back past whitespace-only rich address candidates', () => {
    expect(
      buildBumpaShippingAddress({
        best_address_city: '   ',
        bumpa_shipping_city: 'Lekki',
      })
    ).toMatchObject({
      city: 'Lekki',
    });
  });

  it('returns null when no address data is present', () => {
    expect(buildBumpaShippingAddress({})).toBeNull();
  });
});
