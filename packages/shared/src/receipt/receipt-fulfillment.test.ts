import { describe, expect, it } from 'vitest';
import {
  appendReceiptFulfillmentDescription,
  getReceiptFulfillmentRows,
  getReceiptFulfillmentSummary,
  isDeviceReceiptItemName,
  normalizeReceiptFulfillmentDetails,
  resolveReceiptItemFulfillmentDetails,
} from './receipt-fulfillment';
import type { ReceiptOrder } from './types';

function createReceiptOrder(
  overrides: Partial<ReceiptOrder> = {}
): ReceiptOrder {
  return {
    order_number: 'ORD-123',
    created_at: '2026-04-08T18:02:55.974Z',
    currency: 'NGN',
    total: 500000,
    subtotal: 500000,
    shipping_fee: 0,
    tax_amount: 0,
    discount_amount: 0,
    amount_paid: 500000,
    balance: 0,
    payment_status: 'paid',
    payment_method: 'card',
    customer_name: 'Akinola Ogunniran',
    customer_email: 'akin@example.com',
    customer_phone: null,
    items: [
      {
        product_name: 'Samsung Galaxy S22 Ultra',
        quantity: 1,
        price: 500000,
      },
    ],
    ...overrides,
  };
}

describe('getReceiptFulfillmentRows', () => {
  it('filters blank fulfillment identifiers', () => {
    const rows = getReceiptFulfillmentRows(
      createReceiptOrder({
        fulfillment_details: {
          imei: ' ',
          serialNumber: '',
          serial_number: null,
        },
      })
    );

    expect(rows).toEqual([]);
  });

  it('falls back to legacy serial_number when serialNumber is blank', () => {
    const rows = getReceiptFulfillmentRows(
      createReceiptOrder({
        fulfillment_details: {
          serialNumber: ' ',
          serial_number: 'SN-LEGACY-123',
        },
      })
    );

    expect(rows).toEqual([{ label: 'S/N', value: 'SN-LEGACY-123' }]);
  });

  it('includes non-blank IMEI values', () => {
    const rows = getReceiptFulfillmentRows(
      createReceiptOrder({
        fulfillment_details: {
          imei: 'IMEI-1234567890',
        },
      })
    );

    expect(rows).toEqual([{ label: 'IMEI', value: 'IMEI-1234567890' }]);
  });
});

describe('isDeviceReceiptItemName', () => {
  it('matches concrete phone and computer device names', () => {
    expect(isDeviceReceiptItemName('iPhone 15 Pro')).toBe(true);
    expect(isDeviceReceiptItemName('Samsung Galaxy S22 Ultra')).toBe(true);
    expect(isDeviceReceiptItemName('MacBook Air M3')).toBe(true);
  });

  it('does not treat accessories or partial words as devices', () => {
    expect(isDeviceReceiptItemName('Phone Case')).toBe(false);
    expect(isDeviceReceiptItemName('Laptop Bag')).toBe(false);
    expect(isDeviceReceiptItemName('Simulated Leather Cover')).toBe(false);
  });
});

describe('normalizeReceiptFulfillmentDetails', () => {
  it('returns null for non-object or blank fulfillment details', () => {
    expect(normalizeReceiptFulfillmentDetails(null)).toBeNull();
    expect(normalizeReceiptFulfillmentDetails(['IMEI-1'])).toBeNull();
    expect(
      normalizeReceiptFulfillmentDetails({
        imei: ' ',
        serialNumber: '',
      })
    ).toBeNull();
  });

  it('normalizes non-blank IMEI and legacy serial values', () => {
    expect(
      normalizeReceiptFulfillmentDetails({
        imei: ' 353456789012345 ',
        serial_number: ' SN-LEGACY ',
      })
    ).toEqual({
      imei: '353456789012345',
      serialNumber: 'SN-LEGACY',
    });
  });

  it('preserves per-item fulfillment identifiers', () => {
    expect(
      normalizeReceiptFulfillmentDetails({
        items: [
          {
            imei: ' 111111111111111 ',
            orderItemId: 'item-1',
            productName: 'iPhone 15 Pro',
            serial_number: ' SN-ITEM-1 ',
          },
          {
            imei: '',
            orderItemId: 'item-2',
            serialNumber: ' ',
          },
        ],
      })
    ).toEqual({
      imei: null,
      items: [
        {
          id: null,
          imei: '111111111111111',
          orderItemId: 'item-1',
          productName: 'iPhone 15 Pro',
          serialNumber: 'SN-ITEM-1',
          variantName: null,
        },
      ],
      serialNumber: null,
    });
  });
});

describe('resolveReceiptItemFulfillmentDetails', () => {
  it('matches fulfillment identifiers by order item id', () => {
    const details = normalizeReceiptFulfillmentDetails({
      items: [
        {
          imei: '111111111111111',
          orderItemId: 'item-1',
        },
        {
          imei: '222222222222222',
          orderItemId: 'item-2',
          serialNumber: 'SN-2',
        },
      ],
    });

    expect(
      resolveReceiptItemFulfillmentDetails(details, {
        id: 'item-2',
        name: 'iPhone 15 Pro',
      })
    ).toEqual({
      imei: '222222222222222',
      serialNumber: 'SN-2',
    });
  });

  it('matches fulfillment identifiers by product and variant fallback', () => {
    const details = normalizeReceiptFulfillmentDetails({
      items: [
        {
          imei: '111111111111111',
          productName: 'iPhone 15 Pro',
          variantName: 'Black / 256GB',
        },
      ],
    });

    expect(
      resolveReceiptItemFulfillmentDetails(details, {
        name: 'iPhone 15 Pro',
        variant_name: 'Black / 256GB',
      })
    ).toEqual({
      imei: '111111111111111',
      serialNumber: null,
    });
    expect(
      resolveReceiptItemFulfillmentDetails(details, {
        name: 'iPhone 15 Pro',
      })
    ).toBeNull();
  });

  it('deduplicates repeated identifiers for multi-quantity rows', () => {
    const details = normalizeReceiptFulfillmentDetails({
      items: [
        {
          imei: '111111111111111',
          orderItemId: 'item-1',
          serialNumber: 'SN-1',
        },
        {
          imei: '111111111111111',
          orderItemId: 'item-1',
          serialNumber: 'SN-2',
        },
      ],
    });

    expect(
      resolveReceiptItemFulfillmentDetails(details, {
        id: 'item-1',
      })
    ).toEqual({
      imei: '111111111111111',
      serialNumber: 'SN-1, SN-2',
    });
  });
});

describe('getReceiptFulfillmentSummary', () => {
  it('formats IMEI-only fulfillment details', () => {
    expect(getReceiptFulfillmentSummary({ imei: 'IMEI-123' })).toBe(
      'IMEI: IMEI-123'
    );
  });

  it('formats serial-only fulfillment details', () => {
    expect(getReceiptFulfillmentSummary({ serialNumber: 'SN-123' })).toBe(
      'S/N: SN-123'
    );
  });

  it('falls back to legacy serial_number details', () => {
    expect(getReceiptFulfillmentSummary({ serial_number: 'SN-LEGACY' })).toBe(
      'S/N: SN-LEGACY'
    );
  });

  it('formats combined fulfillment details in display order', () => {
    expect(
      getReceiptFulfillmentSummary({
        imei: 'IMEI-123',
        serialNumber: 'SN-123',
      })
    ).toBe('IMEI: IMEI-123 | S/N: SN-123');
  });

  it('returns null for null or blank fulfillment details', () => {
    expect(getReceiptFulfillmentSummary(null)).toBeNull();
    expect(
      getReceiptFulfillmentSummary({
        imei: ' ',
        serialNumber: '',
        serial_number: null,
      })
    ).toBeNull();
  });
});

describe('appendReceiptFulfillmentDescription', () => {
  it('appends fulfillment details to detected device items', () => {
    expect(
      appendReceiptFulfillmentDescription({
        description: 'Original description',
        fulfillment: { imei: 'IMEI-123', serialNumber: 'SN-123' },
        hasDeviceItem: true,
        index: 1,
        itemName: 'iPhone 15 Pro',
      })
    ).toBe('Original description\nIMEI: IMEI-123 | S/N: SN-123');
  });

  it('uses the first item fallback when no device item is present', () => {
    expect(
      appendReceiptFulfillmentDescription({
        fulfillment: { serialNumber: 'SN-123' },
        hasDeviceItem: false,
        index: 0,
        itemName: 'Custom Order',
      })
    ).toBe('S/N: SN-123');
  });

  it('leaves non-device items unchanged when another device item exists', () => {
    expect(
      appendReceiptFulfillmentDescription({
        description: 'Case',
        fulfillment: { imei: 'IMEI-123' },
        hasDeviceItem: true,
        index: 0,
        itemName: 'Leather Case',
      })
    ).toBe('Case');
  });

  it('returns the original description when fulfillment details are blank', () => {
    expect(
      appendReceiptFulfillmentDescription({
        description: 'Original',
        fulfillment: { imei: ' ', serialNumber: '' },
        hasDeviceItem: false,
        index: 0,
        itemName: 'Custom Order',
      })
    ).toBe('Original');
  });
});
