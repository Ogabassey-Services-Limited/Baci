import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { buildLegacyAdPlatformFanoutEvent } from './build-legacy-ad-platform-fanout-event';

describe('buildLegacyAdPlatformFanoutEvent', () => {
  it('overwrites raw merchant identity with the verified resolved id', () => {
    const event = buildLegacyAdPlatformFanoutEvent({
      eventId: 'event-1',
      eventType: 'purchase',
      input: {
        event_type: 'purchase',
        merchant_id: 'body-merchant',
        order_id: 'order-1',
        source: 'web',
        total: 100,
      },
      request: new NextRequest('https://shop.usebaci.com/api/events', {
        headers: { 'x-real-ip': '203.0.113.1' },
      }),
      resolvedMerchantId: 'resolved-merchant',
    });
    expect(event).toMatchObject({
      custom_data: { order_id: 'order-1', value: 100 },
      event_id: 'event-1',
      merchant_id: 'resolved-merchant',
      user_data: { ip: '203.0.113.1' },
    });
  });
});
