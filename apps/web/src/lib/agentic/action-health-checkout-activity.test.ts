import { describe, expect, it } from 'vitest';
import { buildAgenticCheckoutActivityRecords } from '@/lib/agentic/action-health-checkout-activity';
import type { CheckoutSessionRow } from '@/lib/agentic/action-health-rpc-payload';

describe('buildAgenticCheckoutActivityRecords', () => {
  it('returns the five newest displayable agentic checkout activities', () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      metadata: { agentic: { payment_state: 'payment_pending' } },
      session_id: `session-${index}`,
      status: 'processing',
      updated_at: `2026-05-16T09:0${index}:00.000Z`,
    }));

    expect(
      buildAgenticCheckoutActivityRecords([
        ...rows,
        {
          metadata: { agentic: { payment_state: 'payment_pending' } },
          session_id: 'invalid',
          status: 'processing',
          updated_at: 'not-a-date',
        },
      ]).map((record) => record.session_id)
    ).toEqual([
      'session-5',
      'session-4',
      'session-3',
      'session-2',
      'session-1',
    ]);
  });

  it('returns no activities for empty or entirely malformed rows', () => {
    const malformedRows = [
      {
        metadata: { agentic: { payment_state: 'payment_pending' } },
        session_id: null,
        status: 'processing',
        updated_at: '2026-05-16T09:00:00.000Z',
      },
      {
        metadata: { agentic: { payment_state: 'payment_pending' } },
        session_id: undefined,
        status: 'processing',
        updated_at: '2026-05-16T09:00:00.000Z',
      },
      {
        metadata: { agentic: { payment_state: 'payment_pending' } },
        session_id: '   ',
        status: '   ',
        updated_at: '2026-05-16T09:00:00.000Z',
      },
      {
        metadata: { agentic: {} },
        session_id: 'session-no-payment-state',
        status: 'processing',
        updated_at: 'not-a-date',
      },
    ] as unknown as CheckoutSessionRow[];

    expect(buildAgenticCheckoutActivityRecords([])).toEqual([]);
    expect(() =>
      buildAgenticCheckoutActivityRecords(malformedRows)
    ).not.toThrow();
    expect(buildAgenticCheckoutActivityRecords(malformedRows)).toEqual([]);
  });

  it('keeps fewer than five valid activities ordered newest first', () => {
    expect(
      buildAgenticCheckoutActivityRecords([
        {
          metadata: { agentic: { payment_state: 'payment_pending' } },
          session_id: 'session-old',
          status: 'processing',
          updated_at: '2026-05-16T09:00:00.000Z',
        },
        {
          metadata: { agentic: { payment_state: 'claiming_payment' } },
          session_id: 'session-new',
          status: 'processing',
          updated_at: '2026-05-16T09:02:00.000Z',
        },
      ]).map((record) => record.session_id)
    ).toEqual(['session-new', 'session-old']);
  });
});
