import { describe, expect, it } from 'vitest';
import type { BumpaOrderRow } from '@/schemas/bumpa-orders';
import {
  buildCustomer,
  buildItems,
  mapPaymentStatus,
  mapShippingStatus,
  parseIsoDate,
  parseMoney,
  splitCustomerName,
} from './bumpa-order-preview-values';
import type { ExistingImportedProduct } from './bumpa-types';

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
    'Sub Total': '4500.00',
    Discount: '0',
    'Amount Paid': '5000.00',
    'Amount Due': '0',
    'Order Date': '2026-03-22 14:00:00',
    'Created At': '2026-03-22',
    'Updated At': '',
    'Shipping Price': '500.00',
    Tax: '0',
    'Coupon Code': '',
    'Shipping Option': '',
    'Product SKU': 'WDG-001',
    'Product Quantity': '2',
    ...overrides,
  };
}

describe('parseMoney', () => {
  it('parses a normal price string', () => {
    expect(parseMoney('1500.00')).toBe(1500);
  });

  it('returns 0 for empty string', () => {
    expect(parseMoney('')).toBe(0);
  });

  it('parses decimal strings', () => {
    expect(parseMoney('1500.50')).toBe(1500.5);
  });

  it('supports numeric values with surrounding whitespace', () => {
    expect(parseMoney(' 1500.50 ')).toBe(1500.5);
  });
});

describe('parseIsoDate', () => {
  it('parses ISO date with T separator', () => {
    const result = parseIsoDate('2026-03-22T14:00:00.000Z');
    expect(result).toBe('2026-03-22T14:00:00.000Z');
  });

  it('parses space-separated date by replacing space with T', () => {
    const result = parseIsoDate('2026-03-22 14:00:00');
    expect(result).not.toBeNull();
    expect(result).toContain('2026-03-22');
  });

  it('returns null for empty string', () => {
    expect(parseIsoDate('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseIsoDate('   ')).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(parseIsoDate('not-a-date')).toBeNull();
  });
});

describe('mapPaymentStatus', () => {
  it('maps PAID to paid', () => {
    expect(mapPaymentStatus('PAID')).toBe('paid');
  });

  it('maps PARTIALLY_PAID to partially_paid', () => {
    expect(mapPaymentStatus('PARTIALLY_PAID')).toBe('partially_paid');
  });

  it('maps PARTIALLY PAID (space) to partially_paid', () => {
    expect(mapPaymentStatus('PARTIALLY PAID')).toBe('partially_paid');
  });

  it('maps REFUNDED to refunded', () => {
    expect(mapPaymentStatus('REFUNDED')).toBe('refunded');
  });

  it('maps PENDING to pending', () => {
    expect(mapPaymentStatus('PENDING')).toBe('pending');
  });

  it('maps FAILED to failed', () => {
    expect(mapPaymentStatus('FAILED')).toBe('failed');
  });

  it('maps unknown values to unpaid', () => {
    expect(mapPaymentStatus('SOMETHING_ELSE')).toBe('unpaid');
  });

  it('handles case insensitivity', () => {
    expect(mapPaymentStatus('paid')).toBe('paid');
    expect(mapPaymentStatus('Paid')).toBe('paid');
  });

  it('handles leading/trailing whitespace', () => {
    expect(mapPaymentStatus('  PAID  ')).toBe('paid');
  });
});

describe('mapShippingStatus', () => {
  it('returns cancelled when status is CANCELLED', () => {
    expect(mapShippingStatus('CANCELLED', 'anything')).toBe('cancelled');
  });

  it('returns returned when shipping status is RETURNED', () => {
    expect(mapShippingStatus('OPEN', 'RETURNED')).toBe('returned');
  });

  it('returns delivered when shipping status is DELIVERED', () => {
    expect(mapShippingStatus('OPEN', 'DELIVERED')).toBe('delivered');
  });

  it('returns shipped when shipping status is SHIPPED', () => {
    expect(mapShippingStatus('OPEN', 'SHIPPED')).toBe('shipped');
  });

  it('returns delivered when status is COMPLETED', () => {
    expect(mapShippingStatus('COMPLETED', '')).toBe('delivered');
  });

  it('returns processing when status is PROCESSING', () => {
    expect(mapShippingStatus('PROCESSING', '')).toBe('processing');
  });

  it('returns pending when status is OPEN', () => {
    expect(mapShippingStatus('OPEN', '')).toBe('pending');
  });

  it('returns pending for unknown values', () => {
    expect(mapShippingStatus('UNKNOWN', 'UNKNOWN')).toBe('pending');
  });
});

describe('splitCustomerName', () => {
  it('splits first and last name', () => {
    const result = splitCustomerName('Ada Lovelace');
    expect(result.firstName).toBe('Ada');
    expect(result.lastName).toBe('Lovelace');
  });

  it('handles single name', () => {
    const result = splitCustomerName('Ada');
    expect(result.firstName).toBe('Ada');
    expect(result.lastName).toBeNull();
  });

  it('handles three names (last name joins remaining)', () => {
    const result = splitCustomerName('Ada Augusta Lovelace');
    expect(result.firstName).toBe('Ada');
    expect(result.lastName).toBe('Augusta Lovelace');
  });

  it('returns nulls for empty string', () => {
    const result = splitCustomerName('');
    expect(result.firstName).toBeNull();
    expect(result.lastName).toBeNull();
  });
});

describe('buildCustomer', () => {
  it('creates claimable customer when email is present', () => {
    const customer = buildCustomer(makeRow());
    expect(customer.claimable).toBe(true);
    expect(customer.email).toBeTruthy();
  });

  it('creates non-claimable customer with phone only', () => {
    const customer = buildCustomer(makeRow({ 'Customer Email': '' }));
    expect(customer.claimable).toBe(false);
    expect(customer.phone).toBeTruthy();
    expect(customer.email).toBeNull();
  });

  it('creates anonymous customer with no email or phone', () => {
    const customer = buildCustomer(
      makeRow({ 'Customer Email': '', 'Customer Phone': '' })
    );
    expect(customer.claimable).toBe(false);
    expect(customer.email).toBeNull();
    expect(customer.phone).toBeNull();
  });

  it('uses Customer Name for fullName and splits into parts', () => {
    const customer = buildCustomer(makeRow());
    expect(customer.fullName).toBe('Ada Lovelace');
    expect(customer.firstName).toBe('Ada');
    expect(customer.lastName).toBe('Lovelace');
  });

  it('defaults to Customer when name is empty', () => {
    const customer = buildCustomer(makeRow({ 'Customer Name': '' }));
    expect(customer.fullName).toBe('Customer');
  });
});

describe('buildItems', () => {
  const existingProducts: ExistingImportedProduct[] = [
    {
      id: 'prod-1',
      name: 'Widget',
      sku: 'WDG-001',
      price: 2250,
      externalSource: null,
      externalId: null,
    },
  ];

  it('matches existing product by SKU', () => {
    const items = buildItems(makeRow(), existingProducts);
    expect(items).toHaveLength(1);
    expect(items[0].matched).toBe(true);
    expect(items[0].matchSource).toBe('sku');
    expect(items[0].productId).toBe('prod-1');
  });

  it('matches existing product by name when no SKU', () => {
    const items = buildItems(makeRow({ 'Product SKU': '' }), existingProducts);
    expect(items[0].matched).toBe(true);
    expect(items[0].matchSource).toBe('name');
  });

  it('matches existing products by normalized Bumpa item name when no SKU', () => {
    const items = buildItems(
      makeRow({
        Products: 'Pixel 7a 128gb (Premium Used) IMEI: 351183326811261',
        'Product SKU': '',
      }),
      [
        {
          id: 'pixel-7a',
          name: 'Google Pixel 7a 128GB (Premium Used)',
          sku: null,
          price: 300000,
          externalSource: null,
          externalId: null,
        },
      ]
    );

    expect(items[0]).toMatchObject({
      matched: true,
      matchSource: 'name',
      productId: 'pixel-7a',
    });
  });

  it('marks items as unmatched when no product found', () => {
    const items = buildItems(
      makeRow({ Products: 'Unknown Product', 'Product SKU': 'NOPE' }),
      []
    );
    expect(items[0].matched).toBe(false);
    expect(items[0].matchSource).toBe('unmatched');
    expect(items[0].productId).toBeNull();
  });

  it('handles pipe-delimited multiple products', () => {
    const row = makeRow({
      Products: 'Widget|Gadget',
      'Product SKU': 'WDG-001|',
      'Product Quantity': '2|3',
    });
    const items = buildItems(row, existingProducts);
    expect(items).toHaveLength(2);
    expect(items[0].quantity).toBe(2);
    expect(items[1].quantity).toBe(3);
  });

  it('does not split double pipes used inside a single product title', () => {
    const row = makeRow({
      Products:
        '*Lenovo Thinkpad T14 Gen 1 || 10th Gen || Intel core i5 || 16GB RAM',
      'Product SKU': '',
      'Product Quantity': '1.00',
    });

    const items = buildItems(row, []);

    expect(items).toHaveLength(1);
    expect(items[0].productName).toBe(
      '*Lenovo Thinkpad T14 Gen 1 || 10th Gen || Intel core i5 || 16GB RAM'
    );
  });

  it('removes a matching customer-name prefix before a double-pipe product name', () => {
    const row = makeRow({
      Products:
        'John Onuoha | || | Iphone 16pro 256gb Physical Sim (Premium Used)',
      'Customer Name': 'John Onuoha',
      'Product SKU': '',
      'Product Quantity': '1.00',
    });

    const items = buildItems(row, []);

    expect(items).toHaveLength(1);
    expect(items[0].productName).toBe(
      'Iphone 16pro 256gb Physical Sim (Premium Used)'
    );
  });

  it('removes a matching customer-name prefix before standalone double-pipe markers with extra fragments', () => {
    const row = makeRow({
      Products: 'Ada Lovelace | || | HP EliteBook | 8th Gen',
      'Product SKU': '',
      'Product Quantity': '1.00',
    });

    const items = buildItems(row, []);

    expect(items).toHaveLength(1);
    expect(items[0].productName).toBe('HP EliteBook | 8th Gen');
  });

  it('trims stray trailing double pipes before product-name matching', () => {
    const row = makeRow({
      Products:
        'iPhone 14 Promax 128gb (premium used) | HP elitebook 840 G6 || 8th Gen || Intel Core i7 || 8 GB || 256 GB SSD || Backlit || 14 inch screen || Windows 11 || UK used ||',
      'Product SKU': ' | ',
      'Product Quantity': '1.00 | 1.00',
    });

    const items = buildItems(row, [
      {
        id: 'phone',
        name: 'iPhone 14 Promax 128gb (premium used)',
        sku: null,
        price: 2250,
        externalSource: null,
        externalId: null,
      },
      {
        id: 'laptop',
        name: 'HP elitebook 840 G6 || 8th Gen || Intel Core i7 || 8 GB || 256 GB SSD || Backlit || 14 inch screen || Windows 11 || UK used',
        sku: null,
        price: 2250,
        externalSource: null,
        externalId: null,
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({
      matched: true,
      matchSource: 'name',
      productId: 'laptop',
      productName:
        'HP elitebook 840 G6 || 8th Gen || Intel Core i7 || 8 GB || 256 GB SSD || Backlit || 14 inch screen || Windows 11 || UK used',
    });
  });

  it('uses matched product price for unit price', () => {
    const items = buildItems(makeRow(), existingProducts);
    expect(items[0].unitPrice).toBe(2250);
    expect(items[0].lineTotal).toBe(4500);
  });

  it('infers unit prices when no product match', () => {
    const row = makeRow({ 'Sub Total': '1000.00', 'Product Quantity': '2' });
    const items = buildItems(row, []);
    expect(items[0].unitPrice).toBe(500);
    expect(items[0].lineTotal).toBe(1000);
  });
});
