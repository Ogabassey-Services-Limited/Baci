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
  it('builds stable fallback values and encoded tracking links', () => {
    expect(getFulfillmentOrderNumber(order)).toBe('12345678');
    expect(getFulfillmentOrderItems(order)).toEqual([
      { name: 'Product', quantity: 1 },
    ]);
    expect(buildMerchantEmailContext(merchant)).toMatchObject({
      merchantUrl: 'https://store.usebaci.com',
      replyToEmail: 'support@store.usebaci.com',
    });
    expect(
      buildFulfillmentTrackingUrl('usebaci.com', 'store', order, 'A B')
    ).toBe('https://usebaci.com/track/A%20B');
  });

  it('preserves an explicit zero item quantity', () => {
    expect(
      getFulfillmentOrderItems({
        ...order,
        order_items: [{ name: 'Removed item', quantity: 0 }],
      })
    ).toEqual([{ name: 'Removed item', quantity: 0 }]);
  });
});
