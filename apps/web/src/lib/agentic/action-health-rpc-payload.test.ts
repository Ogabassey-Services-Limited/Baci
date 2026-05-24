import { describe, expect, it } from 'vitest';
import {
  getAgenticPaymentState,
  parseAgenticActionHealthRpcPayload,
} from './action-health-rpc-payload';

describe('action health RPC payload helpers', () => {
  it('normalizes redacted RPC payload rows', () => {
    const result = parseAgenticActionHealthRpcPayload({
      checkout_sessions: [
        {
          metadata: { agentic: { payment_state: ' payment_pending ' } },
          session_id: 'agentic-session-1',
          status: 'processing',
          updated_at: '2026-05-12T10:02:00.000Z',
        },
      ],
      idempotency_records: [
        {
          created_at: '2026-05-12T10:00:00.000Z',
          expires_at: '2026-05-12T10:15:00.000Z',
          route: 'checkout.complete',
          status_code: 503,
          updated_at: '2026-05-12T10:01:00.000Z',
        },
      ],
      request_records: [
        {
          api_version: '2026-04-30',
          created_at: '2026-05-12T10:00:00.000Z',
          expires_at: '2026-05-12T10:15:00.000Z',
          route: 'checkout_sessions.create',
        },
      ],
    });

    expect(result.idempotencyRows).toEqual([
      {
        created_at: '2026-05-12T10:00:00.000Z',
        expires_at: '2026-05-12T10:15:00.000Z',
        route: 'checkout.complete',
        status_code: 503,
        updated_at: '2026-05-12T10:01:00.000Z',
      },
    ]);
    expect(result.requestRows).toEqual([
      {
        api_version: '2026-04-30',
        created_at: '2026-05-12T10:00:00.000Z',
        expires_at: '2026-05-12T10:15:00.000Z',
        route: 'checkout_sessions.create',
      },
    ]);
    expect(result.sessionRows).toHaveLength(1);
    expect(getAgenticPaymentState(result.sessionRows[0]?.metadata)).toBe(
      'payment_pending'
    );
  });

  it('treats malformed payload shapes as empty safe rows', () => {
    const result = parseAgenticActionHealthRpcPayload({
      checkout_sessions: null,
      idempotency_records: [{ status_code: Number.NaN }],
      request_records: 'not-array',
    });

    expect(result).toEqual({
      idempotencyRows: [
        {
          created_at: '',
          expires_at: '',
          route: null,
          status_code: null,
          updated_at: '',
        },
      ],
      requestRows: [],
      sessionRows: [],
    });
    expect(getAgenticPaymentState({ agentic: { payment_state: '' } })).toBe(
      null
    );
  });
});
