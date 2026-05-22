import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';

const getActionHealthRequestControlSummary = vi.fn();
const loadAdminAgenticActionHealthRecords = vi.fn();

vi.mock('@/lib/agentic/action-health-request-controls', () => ({
  getActionHealthRequestControlSummary: (...args: unknown[]) =>
    getActionHealthRequestControlSummary(...args),
}));

vi.mock('@/lib/agentic/action-health-admin-records', () => ({
  loadAdminAgenticActionHealthRecords: (...args: unknown[]) =>
    loadAdminAgenticActionHealthRecords(...args),
}));

describe('loadAgenticActionHealth', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('builds action payload from rpc rows and request controls', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T10:00:00.000Z'));
    getActionHealthRequestControlSummary.mockResolvedValue({
      allowlistCount: 0,
      denylistCount: 1,
      error: null,
      isAgenticCheckoutEnabled: true,
    });

    const rpc = vi.fn().mockResolvedValue({
      data: {
        checkout_sessions: [
          {
            metadata: { agentic: { payment_state: 'payment_pending' } },
            session_id: 'session-1',
            status: 'processing',
            updated_at: '2026-05-14T00:00:00.000Z',
          },
          {
            metadata: { agentic: { payment_state: 'order_finalizing' } },
            session_id: 'session-2',
            status: 'processing',
            updated_at: '2026-05-16T09:00:00.000Z',
          },
          {
            metadata: { agentic: { payment_state: 'claiming_payment' } },
            session_id: 'session-3',
            status: 'processing',
            updated_at: '2026-05-16T09:10:00+00:00',
          },
          {
            metadata: { agentic: { payment_state: 'payment_pending' } },
            session_id: 'session-4',
            status: 'processing',
            updated_at: 'not-a-date',
          },
          {
            metadata: { agentic: {} },
            session_id: 'session-5',
            status: 'processing',
            updated_at: '2026-05-16T09:11:00.000Z',
          },
        ],
        idempotency_records: [
          {
            created_at: '2026-05-16T09:00:00.000Z',
            expires_at: '2026-05-16T09:20:00.000Z',
            route: 'COMPLETE',
            status_code: null,
            updated_at: '2026-05-16T09:01:00.000Z',
          },
          {
            created_at: '2026-05-16T09:15:00.000Z',
            expires_at: '2026-05-16T09:35:00.000Z',
            route: 'checkout_sessions.complete',
            status_code: 503,
            updated_at: '2026-05-16T09:16:00.000Z',
          },
          {
            created_at: '2026-05-16T09:17:00.000Z',
            expires_at: '2026-05-16T09:37:00.000Z',
            route: 'checkout_sessions.update',
            status_code: 500,
            updated_at: '2026-05-16T09:18:00.000Z',
          },
        ],
        request_records: [],
      },
      error: null,
    });
    const supabase = { rpc } as unknown as SupabaseClient;

    const result = await loadAgenticActionHealth(supabase, 'merchant-1');
    const actionCodes = result.actions.map((action) => action.code);

    expect(actionCodes).toContain('AGENTIC_IDEMPOTENCY_ERRORS');
    expect(actionCodes).toContain('AGENTIC_CHECKOUT_COMPLETE_ERRORS');
    expect(actionCodes).toContain('AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS');
    expect(actionCodes).toContain('AGENTIC_ORDER_FINALIZING');
    expect(actionCodes).toContain('AGENTIC_PAYMENT_PENDING_STALE');
    expect(actionCodes).toContain('AGENTIC_PAYMENT_CLAIMING');
    expect(actionCodes).toContain('AGENTIC_AGENT_ALLOWLIST_UNSET');
    expect(result.checkout_sessions).toMatchObject({
      claiming_payment_count: 1,
      order_finalizing_count: 1,
      payment_pending_count: 2,
      records: [
        expect.objectContaining({
          payment_state: 'claiming_payment',
          session_id: 'session-3',
        }),
        expect.objectContaining({
          payment_state: 'order_finalizing',
          session_id: 'session-2',
        }),
        expect.objectContaining({
          payment_state: 'payment_pending',
          session_id: 'session-1',
        }),
      ],
      stale_payment_pending_count: 1,
    });
    expect(result.checkout_sessions).toBeDefined();
    const checkoutSessions = result.checkout_sessions;
    expect(checkoutSessions?.records).not.toContainEqual(
      expect.objectContaining({
        session_id: 'session-4',
      })
    );
    expect(checkoutSessions?.records).not.toContainEqual(
      expect.objectContaining({
        session_id: 'session-5',
      })
    );

    expect(result.idempotency).toMatchObject({
      active_in_progress_count: 0,
      in_progress_count: 1,
      recent_count: 3,
      stale_in_progress_count: 1,
      terminal_error_count: 2,
      records: [
        expect.objectContaining({
          route: 'COMPLETE',
          state: 'in_progress',
          status_code: null,
        }),
        expect.objectContaining({
          route: 'checkout_sessions.complete',
          state: 'server_error',
          status_code: 503,
        }),
        expect.objectContaining({
          route: 'checkout_sessions.update',
          state: 'server_error',
          status_code: 500,
        }),
      ],
    });
  });

  it('throws when rpc returns an error', async () => {
    getActionHealthRequestControlSummary.mockResolvedValue({
      allowlistCount: 1,
      denylistCount: 0,
      error: null,
      isAgenticCheckoutEnabled: true,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('rpc failed'),
      }),
    } as unknown as SupabaseClient;

    await expect(
      loadAgenticActionHealth(supabase, 'merchant-1')
    ).rejects.toThrow('rpc failed');
  });

  it('can load action records directly for admin monitoring', async () => {
    getActionHealthRequestControlSummary.mockResolvedValue({
      allowlistCount: 1,
      denylistCount: 0,
      error: null,
      isAgenticCheckoutEnabled: true,
    });
    loadAdminAgenticActionHealthRecords.mockResolvedValue({
      checkout_sessions: [],
      idempotency_records: [],
      request_records: [],
    });
    const supabase = {
      rpc: vi.fn(),
    } as unknown as SupabaseClient;

    const result = await loadAgenticActionHealth(supabase, 'merchant-1', {
      recordsSource: 'admin_direct',
    });

    expect(loadAdminAgenticActionHealthRecords).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      25
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(result.actions).toEqual([
      expect.objectContaining({
        code: 'AGENTIC_ACTIONS_HEALTHY',
        severity: 'ok',
      }),
    ]);
  });

  it('propagates admin-direct record loading errors without calling the dashboard rpc', async () => {
    getActionHealthRequestControlSummary.mockResolvedValue({
      allowlistCount: 1,
      denylistCount: 0,
      error: null,
      isAgenticCheckoutEnabled: true,
    });
    loadAdminAgenticActionHealthRecords.mockRejectedValue(
      new Error('admin direct failed')
    );
    const supabase = {
      rpc: vi.fn(),
    } as unknown as SupabaseClient;

    await expect(
      loadAgenticActionHealth(supabase, 'merchant-1', {
        recordsSource: 'admin_direct',
      })
    ).rejects.toThrow('admin direct failed');

    expect(loadAdminAgenticActionHealthRecords).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      25
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('ages out old terminal idempotency errors without hiding stale in-progress reservations', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-18T10:00:00.000Z'));
    getActionHealthRequestControlSummary.mockResolvedValue({
      allowlistCount: 1,
      denylistCount: 0,
      error: null,
      isAgenticCheckoutEnabled: true,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          checkout_sessions: [],
          idempotency_records: [
            {
              created_at: '2026-05-09T07:20:00.000Z',
              expires_at: '2026-05-09T07:40:00.000Z',
              route: 'checkout_sessions.complete',
              status_code: 500,
              updated_at: '2026-05-09T07:28:45.000Z',
            },
            {
              created_at: '2026-05-09T07:30:00.000Z',
              expires_at: '2026-05-09T07:50:00.000Z',
              route: 'checkout_sessions.complete',
              status_code: null,
              updated_at: '2026-05-09T07:31:00.000Z',
            },
          ],
          request_records: [],
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const result = await loadAgenticActionHealth(supabase, 'merchant-1');

    expect(result.idempotency).toMatchObject({
      recent_count: 1,
      stale_in_progress_count: 1,
      terminal_error_count: 0,
    });
    expect(result.idempotency?.records).toEqual([
      expect.objectContaining({
        route: 'checkout_sessions.complete',
        state: 'in_progress',
        status_code: null,
      }),
    ]);
    expect(result.actions.map((action) => action.code)).toEqual([
      'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
    ]);
  });
});
