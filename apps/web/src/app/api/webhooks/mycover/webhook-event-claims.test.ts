import { describe, expect, it } from 'vitest';
import { isStaleWebhookClaim } from './webhook-event-claims';

describe('MyCover webhook event claim helpers', () => {
  it('treats only old processing claims as stale', () => {
    const now = Date.parse('2026-06-27T12:00:00.000Z');

    expect(
      isStaleWebhookClaim(
        {
          processing_status: 'processing',
          received_at: '2026-06-27T11:49:59.000Z',
        },
        now
      )
    ).toBe(true);
    expect(
      isStaleWebhookClaim(
        {
          processing_status: 'processing',
          received_at: '2026-06-27T11:59:00.000Z',
        },
        now
      )
    ).toBe(false);
    expect(
      isStaleWebhookClaim(
        { processing_status: 'processed', received_at: '2026-06-27T11:00:00Z' },
        now
      )
    ).toBe(false);
  });
});
