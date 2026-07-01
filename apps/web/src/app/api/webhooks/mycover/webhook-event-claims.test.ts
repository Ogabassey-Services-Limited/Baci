import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  claimMyCoverWebhookEvent,
  isStaleWebhookClaim,
} from './webhook-event-claims';

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

  it('is never stale when received_at is missing or unparsable', () => {
    const now = Date.parse('2026-06-27T12:00:00.000Z');
    expect(isStaleWebhookClaim({ processing_status: 'processing' }, now)).toBe(
      false
    );
    expect(
      isStaleWebhookClaim(
        { processing_status: 'processing', received_at: null },
        now
      )
    ).toBe(false);
    expect(
      isStaleWebhookClaim(
        { processing_status: 'processing', received_at: 'not-a-date' },
        now
      )
    ).toBe(false);
  });
});

describe('claimMyCoverWebhookEvent', () => {
  function makeSupabase(
    insertResults: Array<{ error: { code: string } | null }>,
    selectResults: Array<{ data: unknown; error: unknown }>
  ) {
    let insertIdx = 0;
    let selectIdx = 0;
    return {
      from: () => ({
        insert: () => Promise.resolve(insertResults[insertIdx++]),
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(selectResults[selectIdx++]),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
  }

  it('reclaims the event when the conflicting row vanished before lookup', async () => {
    // insert conflicts (23505), the row is gone on lookup (released by a failed
    // worker), then the retry insert succeeds.
    const supabase = makeSupabase(
      [{ error: { code: '23505' } }, { error: null }],
      [{ data: null, error: null }]
    );

    const result = await claimMyCoverWebhookEvent(supabase, {
      event: 'claim.paid',
      event_id: 'evt-1',
      data: {},
    });

    expect(result.status).toBe('claimed');
  });

  it('reports a duplicate when an active claimant still holds the row', async () => {
    const supabase = makeSupabase(
      [{ error: { code: '23505' } }],
      [
        {
          data: {
            processing_status: 'processing',
            received_at: new Date().toISOString(),
          },
          error: null,
        },
      ]
    );

    const result = await claimMyCoverWebhookEvent(supabase, {
      event: 'claim.paid',
      event_id: 'evt-2',
      data: {},
    });

    expect(result.status).toBe('processing_duplicate');
  });
});
