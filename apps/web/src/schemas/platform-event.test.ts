import { describe, expect, it } from 'vitest';
import {
  platformEventDataSchema,
  platformEventRequestSchema,
} from '@/schemas/platform-event';

describe('platformEventRequestSchema', () => {
  const merchantId = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235';

  it('accepts a minimal page-view event', () => {
    const result = platformEventRequestSchema.safeParse({
      event_type: 'landing_page_view',
      page_url: 'https://usebaci.com',
      session_id: 'ps_123',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a purchase event with a valid 3-letter currency and normalizes case', () => {
    const result = platformEventRequestSchema.safeParse({
      event_type: 'platform_purchase',
      merchant_id: merchantId,
      event_data: { value: 15_000, currency: 'ghs', order_id: 'order-1' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_data?.currency).toBe('GHS');
      expect(result.data.event_data?.order_id).toBe('order-1');
    }
  });

  it('rejects a malformed optional merchant identifier', () => {
    const result = platformEventRequestSchema.safeParse({
      event_type: 'platform_purchase',
      event_data: { value: 15_000, currency: 'GHS', order_id: 'order-1' },
      merchant_id: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown event_type', () => {
    const result = platformEventRequestSchema.safeParse({
      event_type: 'not_a_real_event',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed currency code', () => {
    const result = platformEventRequestSchema.safeParse({
      event_type: 'platform_purchase',
      event_data: { value: 15_000, currency: 'NAIRA' },
    });

    expect(result.success).toBe(false);
  });
});

describe('platformEventDataSchema', () => {
  it('accepts documented non-sensitive event metadata', () => {
    const result = platformEventDataSchema.safeParse({
      store_slug: 'my-store',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.store_slug).toBe('my-store');
    }
  });

  it('rejects arbitrary or sensitive metadata fields', () => {
    expect(
      platformEventDataSchema.safeParse({ customer_email: 'a@example.com' })
        .success
    ).toBe(false);
  });

  it('rejects a negative purchase value', () => {
    const result = platformEventDataSchema.safeParse({ value: -1 });

    expect(result.success).toBe(false);
  });
});
