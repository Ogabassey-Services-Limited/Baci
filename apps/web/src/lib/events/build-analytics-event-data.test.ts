import { describe, expect, it } from 'vitest';
import { buildAnalyticsEventData } from './build-analytics-event-data';

describe('buildAnalyticsEventData', () => {
  it('normalizes checkout fallback fields without undefined values', () => {
    expect(
      buildAnalyticsEventData(
        {
          custom_data: {
            contents: [{ id: 'sku-1', quantity: 1 }],
            currency: 'NGN',
            order_id: 'order-1',
            value: 100,
          },
          event_type: 'purchase',
          merchant_id: 'merchant-1',
        },
        'purchase'
      )
    ).toEqual({
      currency: 'NGN',
      item_count: 1,
      items: [{ id: 'sku-1', quantity: 1 }],
      order_id: 'order-1',
      total: 100,
    });
  });

  it('keeps arbitrary custom fields nested', () => {
    expect(
      buildAnalyticsEventData(
        {
          custom_data: { campaign_variant: 'b' },
          event_type: 'custom_event',
          merchant_id: 'merchant-1',
        },
        'custom_event'
      )
    ).toEqual({ custom_data: { campaign_variant: 'b' } });
  });

  it('preserves mobile product conversion contents from custom data', () => {
    expect(
      buildAnalyticsEventData(
        {
          custom_data: {
            contents: [{ id: 'sku-1', name: 'Phone', price: 100, quantity: 2 }],
            currency: 'NGN',
            value: 200,
          },
          event_type: 'add_to_cart',
          merchant_id: 'merchant-1',
        },
        'add_to_cart'
      )
    ).toEqual({
      currency: 'NGN',
      items: [{ id: 'sku-1', name: 'Phone', price: 100, quantity: 2 }],
      total: 200,
    });
  });
});
