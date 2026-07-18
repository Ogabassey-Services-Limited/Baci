import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { tiktokEventsAPIHelpers } from './tiktok-events-api-helpers';

function sha256(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

describe('tiktokEventsAPIHelpers', () => {
  it('builds a provider payload with normalized event time and hashed matching data', () => {
    const payload = tiktokEventsAPIHelpers.buildPayload({
      eventName: 'Purchase',
      options: {
        eventId: 'event-1',
        eventTime: '2026-05-29T20:02:19.000Z',
        url: 'https://example.com/product',
      },
      properties: { contentId: 'sku-1', value: 100 },
      userData: {
        email: 'Buyer@Example.com',
        phone: '+234 800 123 4567',
      },
    });

    expect(payload).toMatchObject({
      event: 'Purchase',
      event_id: 'event-1',
      event_time: 1_780_084_939,
      page: { url: 'https://example.com/product' },
      user: {
        email: sha256('Buyer@Example.com'),
        phone: sha256('+2348001234567'),
      },
    });
  });

  it('uses current seconds for invalid event times', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_780_084_939_000);

    const payload = tiktokEventsAPIHelpers.buildPayload({
      eventName: 'ViewContent',
      options: { eventTime: 'invalid' },
      userData: {},
    });

    expect(payload.event_time).toBe(1_780_084_939);
  });

  it('enriches content fields from the first content item', () => {
    expect(
      tiktokEventsAPIHelpers.withFirstContent({
        contents: [
          {
            content_id: 'sku-1',
            content_name: 'Phone',
            price: 100,
          },
        ],
      })
    ).toMatchObject({
      contentId: 'sku-1',
      contentName: 'Phone',
      contentType: 'product',
      price: 100,
    });
  });
});
