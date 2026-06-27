import { describe, expect, it } from 'vitest';
import type { BumpaOrderRow } from '@/schemas/bumpa-orders';
import { buildItems } from './build-bumpa-order-items';

function makeRow(overrides: Partial<BumpaOrderRow> = {}): BumpaOrderRow {
  return {
    id: '100',
    'Order Number': '001',
    Products: 'Widget',
    'Customer Name': 'Ada Lovelace',
    'Customer Email': 'ada@example.com',
    'Customer Phone': '08012345678',
    'Payment Status': 'PAID',
    Status: 'PROCESSING',
    'Shipping Status': 'UNFULFILLED',
    Channel: 'WEB',
    Origin: '',
    Total: '5000.00',
    'Sub Total': '5000.00',
    Discount: '0',
    'Amount Paid': '5000.00',
    'Amount Due': '0',
    'Order Date': '2026-03-22 14:00:00',
    'Created At': '2026-03-22',
    'Updated At': '',
    'Shipping Price': '0',
    Tax: '0',
    'Coupon Code': '',
    'Shipping Option': '',
    'Product SKU': '',
    'Product Quantity': '1',
    items_json: '',
    ...overrides,
  };
}

describe('buildItems', () => {
  it('splits flat pipe-separated product rows into multiple items', () => {
    const items = buildItems(
      makeRow({
        Products: 'Phone | Case',
        'Product Quantity': '1 | 2',
      }),
      []
    );

    expect(items).toEqual([
      expect.objectContaining({
        productName: 'Phone',
        quantity: 1,
        unitPrice: 2500,
        lineTotal: 2500,
      }),
      expect.objectContaining({
        productName: 'Case',
        quantity: 2,
        unitPrice: 1250,
        lineTotal: 2500,
      }),
    ]);
  });

  it('strips customer double-pipe prefixes before multi-item splitting', () => {
    const items = buildItems(
      makeRow({
        Products: 'Ada Lovelace | || | iPhone 15 | Pouch',
        'Product Quantity': '1 | 1',
      }),
      []
    );

    expect(items.map((item) => item.productName)).toEqual([
      'iPhone 15',
      'Pouch',
    ]);
  });

  it('falls back to flat product fields when rich items_json is empty or malformed', () => {
    expect(
      buildItems(
        makeRow({
          Products: 'Fallback Phone',
          'Product Quantity': '2',
          items_json: '[]',
        }),
        []
      )
    ).toEqual([
      expect.objectContaining({
        productName: 'Fallback Phone',
        quantity: 2,
        unitPrice: 2500,
        lineTotal: 5000,
      }),
    ]);

    expect(
      buildItems(
        makeRow({
          Products: 'Fallback Charger',
          'Product Quantity': '1',
          items_json: '{not-valid-json',
        }),
        []
      )
    ).toEqual([
      expect.objectContaining({
        productName: 'Fallback Charger',
        quantity: 1,
        unitPrice: 5000,
        lineTotal: 5000,
      }),
    ]);
  });

  it('prefers rich Bumpa item line totals over catalog match prices', () => {
    const items = buildItems(
      makeRow({
        items_json: JSON.stringify([
          {
            name: 'Widget',
            quantity: 2,
            total: 5000,
          },
        ]),
      }),
      [
        {
          id: 'prod-1',
          name: 'Widget',
          sku: null,
          price: 999,
          externalSource: null,
          externalId: null,
        },
      ]
    );

    expect(items[0]).toMatchObject({
      productId: 'prod-1',
      unitPrice: 2500,
      lineTotal: 5000,
    });
  });

  it('uses row quantities for rich items that omit item-level quantity', () => {
    const items = buildItems(
      makeRow({
        'Product Quantity': '3',
        items_json: JSON.stringify([
          {
            name: 'Widget',
            total: 6000,
          },
        ]),
      }),
      []
    );

    expect(items[0]).toMatchObject({
      productName: 'Widget',
      quantity: 3,
      unitPrice: 2000,
      lineTotal: 6000,
    });
  });

  it('uses matched catalog prices for flat product rows', () => {
    const items = buildItems(
      makeRow({
        Products: 'Phone | Case',
        'Product Quantity': '1 | 1',
        'Sub Total': '4000.00',
      }),
      [
        {
          id: 'prod-phone',
          name: 'Phone',
          sku: null,
          price: 3000,
          externalSource: null,
          externalId: null,
        },
        {
          id: 'prod-case',
          name: 'Case',
          sku: null,
          price: 1000,
          externalSource: null,
          externalId: null,
        },
      ]
    );

    expect(items).toEqual([
      expect.objectContaining({
        productId: 'prod-phone',
        unitPrice: 3000,
        lineTotal: 3000,
      }),
      expect.objectContaining({
        productId: 'prod-case',
        unitPrice: 1000,
        lineTotal: 1000,
      }),
    ]);
  });

  it('uses matched catalog snapshots for imported Fold names with bracketed condition', () => {
    const items = buildItems(
      makeRow({
        Products: 'Samsung Galaxy Fold 5 512GB (Premium Used)',
        'Product Quantity': '1',
        'Sub Total': '930000.00',
      }),
      [
        {
          id: 'fold-5',
          name: 'Samsung Galaxy Z Fold 5 / Z Fold 5 12GB 512GB',
          sku: null,
          price: 930000,
          images: ['https://cdn.example.com/fold-5.jpg'],
          condition: 'used',
          externalSource: null,
          externalId: null,
          status: 'active',
        },
      ]
    );

    expect(items[0]).toMatchObject({
      productId: 'fold-5',
      productName: 'Samsung Galaxy Z Fold 5 / Z Fold 5 12GB 512GB',
      condition: 'used',
      variantName: 'Used',
      imageUrl: 'https://cdn.example.com/fold-5.jpg',
      unitPrice: 930000,
      lineTotal: 930000,
      matched: true,
      matchSource: 'name',
    });
  });

  it('does not use untrusted plain condition words as catalog match overrides', () => {
    const items = buildItems(
      makeRow({
        Products: 'New 2025 Apple iPad M3 256GB WiFi',
        'Product Quantity': '1',
        'Sub Total': '500000.00',
      }),
      [
        {
          id: 'ipad-generic',
          name: 'New 2025 Apple iPad M3 256GB WiFi',
          sku: null,
          price: 500_000,
          images: ['https://cdn.example.com/ipad-generic.jpg'],
          condition: null,
          externalSource: null,
          externalId: null,
          status: 'active',
        },
        {
          id: 'ipad-new',
          name: 'New 2025 Apple iPad M3 256GB WiFi',
          sku: null,
          price: 700_000,
          images: ['https://cdn.example.com/ipad-new.jpg'],
          condition: 'new',
          externalSource: null,
          externalId: null,
          status: 'active',
        },
      ]
    );

    expect(items[0]).toMatchObject({
      productId: 'ipad-generic',
      productName: 'New 2025 Apple iPad M3 256GB WiFi',
      condition: null,
      variantName: null,
      imageUrl: 'https://cdn.example.com/ipad-generic.jpg',
      unitPrice: 500_000,
      lineTotal: 500_000,
      matched: true,
      matchSource: 'name',
    });
  });

  it('uses rich fulfillment condition when choosing between catalog condition variants', () => {
    const items = buildItems(
      makeRow({
        'Sub Total': '450000.00',
        items_json: JSON.stringify([
          {
            description: 'Premium Used IMEI: 123456789012345',
            name: 'iPhone 13 128GB',
            quantity: 1,
          },
        ]),
      }),
      [
        {
          id: 'iphone-13-new',
          name: 'iPhone 13 128GB',
          sku: null,
          price: 600000,
          images: ['https://cdn.example.com/iphone-new.jpg'],
          condition: 'new',
          externalSource: null,
          externalId: null,
          status: 'active',
        },
        {
          id: 'iphone-13-used',
          name: 'iPhone 13 128GB',
          sku: null,
          price: 450000,
          images: ['https://cdn.example.com/iphone-used.jpg'],
          condition: 'used',
          externalSource: null,
          externalId: null,
          status: 'active',
        },
      ]
    );

    expect(items[0]).toMatchObject({
      productId: 'iphone-13-used',
      condition: 'used',
      variantName: 'Used',
      imageUrl: 'https://cdn.example.com/iphone-used.jpg',
    });
  });
});
