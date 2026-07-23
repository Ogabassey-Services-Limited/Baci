import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { facebookCAPIHelpers } from './facebook-capi-helpers';

function sha256(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

describe('facebookCAPIHelpers', () => {
  it('builds the provider event without exposing unhashed matching data', () => {
    const event = facebookCAPIHelpers.buildEvent({
      customData: { contentIds: ['sku-1'], value: 100 },
      eventId: 'event-1',
      eventName: 'Purchase',
      eventSourceUrl: 'https://example.com/products/sku-1',
      eventTime: 1_783_857_600,
      limitedDataUse: true,
      userData: {
        email: 'Buyer@Example.com',
        phone: '+234 800 123 4567',
      },
    });

    expect(event).toMatchObject({
      action_source: 'website',
      event_id: 'event-1',
      event_name: 'Purchase',
      event_time: 1_783_857_600,
      opt_out: true,
      user_data: {
        em: sha256('Buyer@Example.com'),
        ph: sha256('+2348001234567'),
      },
    });
    expect(JSON.stringify(event)).not.toContain('Buyer@Example.com');
    expect(JSON.stringify(event)).not.toContain('+234 800 123 4567');
  });

  it('adds request-only test and Limited Data Use controls', () => {
    const body = facebookCAPIHelpers.buildRequestBody({
      accessToken: 'token-1',
      event: facebookCAPIHelpers.buildEvent({
        eventId: 'event-1',
        eventName: 'PageView',
        limitedDataUse: true,
        userData: {},
      }),
      limitedDataUse: true,
      testEventCode: 'test-code',
    });

    expect(body).toMatchObject({
      access_token: 'token-1',
      data_processing_options: ['LDU'],
      data_processing_options_country: 1,
      data_processing_options_state: 1000,
      test_event_code: 'test-code',
    });
  });
});
