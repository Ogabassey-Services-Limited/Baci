import { describe, expect, it } from 'vitest';
import { summarizeAgenticActionHealth } from '@/lib/agentic/action-health-summary';

describe('summarizeAgenticActionHealth', () => {
  it('keeps aggregate action health without request or session records', () => {
    const summary = summarizeAgenticActionHealth({
      actions: [
        {
          code: 'AGENTIC_PAYMENT_SETUP_FAILED',
          count: 1,
          message: 'Payment setup failed',
          severity: 'attention',
        },
        {
          code: 'AGENTIC_PAYMENT_PENDING',
          count: 2,
          message: 'Payment pending',
          severity: 'monitor',
        },
        {
          code: 'AGENTIC_ACTIONS_HEALTHY',
          count: 0,
          message: 'Healthy',
          severity: 'ok',
        },
      ],
      checkout_sessions: {
        payment_pending_count: 2,
        recent_count: 3,
        records: [
          {
            payment_state: 'payment_pending',
            session_id: 'agentic_session_1',
            status: 'processing',
            updated_at: '2026-05-22T08:02:00.000Z',
          },
        ],
      },
      generated_at: '2026-05-22T03:00:00.000Z',
      idempotency: {
        recent_count: 4,
        terminal_error_count: 1,
        records: [
          {
            created_at: '2026-05-22T08:00:00.000Z',
            expires_at: '2026-05-22T08:20:00.000Z',
            route: 'checkout_sessions.complete',
            state: 'server_error',
            status_code: 503,
            updated_at: '2026-05-22T08:01:00.000Z',
          },
        ],
      },
      request_controls: {
        allowlist_count: 1,
        denylist_count: 0,
        fetch_error: false,
        is_agentic_checkout_enabled: true,
      },
      requests: {
        recent_count: 1,
        records: [
          {
            agent_id: 'openai:chatgpt',
            api_version: '2026-04-28',
            created_at: '2026-05-22T08:03:00.000Z',
            expires_at: '2026-05-22T08:18:00.000Z',
            route: 'checkout_sessions.complete',
          },
        ],
      },
    });

    expect(summary).toEqual({
      actions: {
        attention_count: 1,
        monitor_count: 1,
        ok_count: 1,
        total_count: 3,
      },
      checkout_sessions: {
        claiming_payment_count: undefined,
        order_finalizing_count: undefined,
        payment_pending_count: 2,
        payment_setup_failed_count: undefined,
        recent_count: 3,
        stale_payment_pending_count: undefined,
      },
      generated_at: '2026-05-22T03:00:00.000Z',
      idempotency: {
        active_in_progress_count: undefined,
        in_progress_count: undefined,
        recent_count: 4,
        stale_in_progress_count: undefined,
        terminal_error_count: 1,
      },
      request_controls: {
        allowlist_count: 1,
        denylist_count: 0,
        fetch_error: false,
        is_agentic_checkout_enabled: true,
      },
      requests: {
        recent_count: 1,
      },
    });
    expect(summary.checkout_sessions).not.toHaveProperty('records');
    expect(summary.idempotency).not.toHaveProperty('records');
    expect(summary.requests).not.toHaveProperty('records');
  });

  it('returns default counts and preserves sparse optional sections', () => {
    const summary = summarizeAgenticActionHealth({
      actions: [],
      generated_at: '2026-05-22T03:00:00.000Z',
      requests: {},
    });

    expect(summary).toEqual({
      actions: {
        attention_count: 0,
        monitor_count: 0,
        ok_count: 0,
        total_count: 0,
      },
      checkout_sessions: undefined,
      generated_at: '2026-05-22T03:00:00.000Z',
      idempotency: undefined,
      request_controls: undefined,
      requests: {
        recent_count: undefined,
      },
    });
    expect('records' in (summary.checkout_sessions ?? {})).toBe(false);
    expect('records' in (summary.idempotency ?? {})).toBe(false);
    expect('records' in (summary.requests ?? {})).toBe(false);
  });
});
