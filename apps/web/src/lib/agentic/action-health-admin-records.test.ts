import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { loadAdminAgenticActionHealthRecords } from '@/lib/agentic/action-health-admin-records';

function createQueryMock({
  data,
  error = null,
}: {
  data: unknown[];
  error?: unknown;
}) {
  const query = {
    eq: vi.fn(),
    limit: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({ data, error });
  return query;
}

describe('loadAdminAgenticActionHealthRecords', () => {
  it('loads service-role-safe action health rows without the dashboard RPC', async () => {
    const idempotencyRows = [
      {
        created_at: '2026-05-22T08:00:00.000Z',
        expires_at: '2026-05-22T08:20:00.000Z',
        route: 'checkout_sessions.complete',
        status_code: 503,
        updated_at: '2026-05-22T08:01:00.000Z',
      },
    ];
    const checkoutRows = [
      {
        metadata: { agentic: { payment_state: 'payment_pending' } },
        session_id: 'agentic_session_1',
        status: 'processing',
        updated_at: '2026-05-22T08:02:00.000Z',
      },
    ];
    const idempotencyQuery = createQueryMock({ data: idempotencyRows });
    const checkoutQuery = createQueryMock({ data: checkoutRows });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'agentic_idempotency_records') return idempotencyQuery;
        if (table === 'checkout_sessions') return checkoutQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    const result = await loadAdminAgenticActionHealthRecords(
      supabase,
      'merchant-1',
      25
    );

    expect(supabase.from).toHaveBeenCalledWith('agentic_idempotency_records');
    expect(supabase.from).toHaveBeenCalledWith('checkout_sessions');
    expect(idempotencyQuery.select).toHaveBeenCalledWith(
      'route, status_code, created_at, updated_at, expires_at'
    );
    expect(checkoutQuery.select).toHaveBeenCalledWith(
      'session_id, status, metadata, updated_at'
    );
    expect(idempotencyQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(checkoutQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(checkoutQuery.not).toHaveBeenCalledWith(
      'metadata->agentic',
      'is',
      null
    );
    expect(idempotencyQuery.order).toHaveBeenCalledWith('updated_at', {
      ascending: false,
    });
    expect(checkoutQuery.order).toHaveBeenCalledWith('updated_at', {
      ascending: false,
    });
    expect(idempotencyQuery.limit).toHaveBeenCalledWith(25);
    expect(checkoutQuery.limit).toHaveBeenCalledWith(25);
    expect(result).toEqual({
      checkout_sessions: checkoutRows,
      idempotency_records: idempotencyRows,
      request_records: [],
    });
  });

  it('throws when direct record loading fails', async () => {
    const idempotencyQuery = createQueryMock({
      data: [],
      error: new Error('record load failed'),
    });
    const checkoutQuery = createQueryMock({ data: [] });
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'agentic_idempotency_records'
          ? idempotencyQuery
          : checkoutQuery
      ),
    } as unknown as SupabaseClient;

    await expect(
      loadAdminAgenticActionHealthRecords(supabase, 'merchant-1', 25)
    ).rejects.toThrow('record load failed');
  });
});
