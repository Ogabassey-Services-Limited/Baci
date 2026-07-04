import type { OrderFulfillmentDetails } from '@baci/shared';
import { describe, expect, it } from 'vitest';
import type { OrderDetailsItem } from '@/components/orders/order-details.types';
import { resolveReceiptItemFulfillmentDetails } from './resolveReceiptItemFulfillmentDetails';

const baseItem: OrderDetailsItem = {
  id: 'item-1',
  name: 'Samsung Galaxy Buds4 Pro',
  price: 280_000,
  product_id: 'product-1',
  quantity: 1,
};

describe('resolveReceiptItemFulfillmentDetails', () => {
  it('matches fulfillment entries by order item id', () => {
    const details: OrderFulfillmentDetails = {
      items: [
        {
          orderItemId: 'item-1',
          serialNumber: 'SN-123',
        },
      ],
    };

    expect(resolveReceiptItemFulfillmentDetails(details, baseItem)).toEqual({
      imei: null,
      serialNumber: 'SN-123',
    });
  });

  it('matches fulfillment entries by product and variant fallback', () => {
    const details: OrderFulfillmentDetails = {
      items: [
        {
          productName: 'Samsung Galaxy Buds4 Pro',
          serial_number: 'SN-BLACK',
          variantName: 'Black',
        },
        {
          productName: 'Samsung Galaxy Buds4 Pro',
          serial_number: 'SN-SILVER',
          variantName: 'Silver',
        },
      ],
    };
    const item: OrderDetailsItem = {
      ...baseItem,
      id: 'item-variant',
      variant_name: 'Silver',
    };

    expect(resolveReceiptItemFulfillmentDetails(details, item)).toEqual({
      imei: null,
      serialNumber: 'SN-SILVER',
    });
  });

  it('does not match blank fulfillment variants to variant-tracked order items', () => {
    const details: OrderFulfillmentDetails = {
      items: [
        {
          productName: 'Samsung Galaxy Buds4 Pro',
          serial_number: 'SN-LEGACY',
        },
      ],
    };
    const item: OrderDetailsItem = {
      ...baseItem,
      id: 'item-variant',
      variant_name: 'Silver',
    };

    expect(resolveReceiptItemFulfillmentDetails(details, item)).toBeNull();
  });

  it('matches fulfillment entries by exact entry id', () => {
    const details: OrderFulfillmentDetails = {
      items: [
        {
          id: 'item-1',
          serialNumber: 'SN-EXACT',
        },
      ],
    };

    expect(resolveReceiptItemFulfillmentDetails(details, baseItem)).toEqual({
      imei: null,
      serialNumber: 'SN-EXACT',
    });
  });

  it('matches fulfillment entries by snake case order item id', () => {
    const details: OrderFulfillmentDetails = {
      items: [
        {
          order_item_id: 'item-1',
          serialNumber: 'SN-SNAKE',
        },
      ],
    };

    expect(resolveReceiptItemFulfillmentDetails(details, baseItem)).toEqual({
      imei: null,
      serialNumber: 'SN-SNAKE',
    });
  });

  it('deduplicates identifiers across multiple matched units', () => {
    const details: OrderFulfillmentDetails = {
      items: [
        {
          id: 'item-1:0',
          imei: '353456789012345',
          serialNumber: 'SN-123',
        },
        {
          id: 'item-1:1',
          imei: '353456789012345',
          serialNumber: 'SN-456',
        },
      ],
    };

    expect(resolveReceiptItemFulfillmentDetails(details, baseItem)).toEqual({
      imei: '353456789012345',
      serialNumber: 'SN-123, SN-456',
    });
  });

  it('returns null when matched entries do not include identifiers', () => {
    const details: OrderFulfillmentDetails = {
      items: [
        {
          orderItemId: 'item-1',
          productName: 'Samsung Galaxy Buds4 Pro',
        },
      ],
    };

    expect(resolveReceiptItemFulfillmentDetails(details, baseItem)).toBeNull();
  });

  it('returns null when no entries match the order item', () => {
    const details: OrderFulfillmentDetails = {
      items: [
        {
          orderItemId: 'other-item',
          serialNumber: 'SN-999',
        },
      ],
    };

    expect(resolveReceiptItemFulfillmentDetails(details, baseItem)).toBeNull();
  });

  it('returns null when details are missing', () => {
    expect(resolveReceiptItemFulfillmentDetails(null, baseItem)).toBeNull();
    expect(
      resolveReceiptItemFulfillmentDetails(undefined, baseItem)
    ).toBeNull();
  });
});
