import { describe, expect, it } from 'vitest';
import {
  buildFulfillmentTrackingUrl,
  buildMerchantEmailContext,
  getFulfillmentOrderItems,
  getFulfillmentOrderNumber,
} from './order-fulfillment-notification-sender-helpers';
import type {
  FulfillmentOrderRecord,
  MerchantRecord,
} from './order-fulfillment-notification-types';

const order: FulfillmentOrderRecord = {
  id: '12345678-order',
  customer_name: 'Customer',
  order_number: null,
  order_items: [{ name: null, quantity: null }],
  shipping_status: 'shipped',
};
const merchant: MerchantRecord = {
  id: 'merchant-1',
  business_name: 'Store',
  slug: 'store',
  support_email: null,
  email_sender_name: null,
  email: null,
};

describe('order fulfillment sender helpers', () => {
  it('builds stable order fallback values', () => {
    const orderNumber = getFulfillmentOrderNumber(order);
    const items = getFulfillmentOrderItems(order);

    expect(orderNumber).toBe('12345678');
    expect(items).toEqual([{ name: 'Product', quantity: 1 }]);
  });

  it('builds merchant email context from the merchant slug', () => {
    const context = buildMerchantEmailContext(merchant);

    expect(context).toMatchObject({
      merchantUrl: 'https://store.usebaci.com',
      replyToEmail: 'support@store.usebaci.com',
    });
  });

  it('encodes the tracking token in the public tracking URL', () => {
    const trackingUrl = buildFulfillmentTrackingUrl(
      'usebaci.com',
      'store',
      order,
      'A B'
    );

    expect(trackingUrl).toBe('https://usebaci.com/track/A%20B');
  });

  it('preserves an explicit zero item quantity', () => {
    const items = getFulfillmentOrderItems({
      ...order,
      order_items: [{ name: 'Removed item', quantity: 0 }],
    });

    expect(items).toEqual([{ name: 'Removed item', quantity: 0 }]);
  });
});
