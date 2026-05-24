import { describe, expect, it, vi } from 'vitest';
import {
  AGENTIC_REPLAY_REQUEST_ID_ERROR,
  AGENTIC_REPLAY_RESERVATION_FAILED_ERROR,
  reserveAgenticRequestId,
} from '@/lib/agentic/request-replay';

function createSupabaseMock({
  deleteError = null,
  insertError = null,
}: {
  deleteError?: { code?: string; message?: string } | null;
  insertError?: { code?: string; message?: string } | null;
} = {}) {
  const deleteLt = vi.fn().mockResolvedValue({ error: deleteError });
  const deleteChain = {
    eq: vi.fn(),
    lt: deleteLt,
  };
  deleteChain.eq.mockReturnValue(deleteChain);
  const insertSelect = vi.fn(() => ({
    maybeSingle: vi.fn().mockResolvedValue({
      data: insertError ? null : { id: 'record-1' },
      error: insertError,
    }),
  }));
  const insert = vi.fn(() => ({ select: insertSelect }));
  const from = vi.fn(() => ({
    delete: vi.fn(() => deleteChain),
    insert,
  }));

  return {
    deleteEq: deleteChain.eq,
    deleteLt,
    from,
    insert,
    supabase: { from },
  };
}

describe('reserveAgenticRequestId', () => {
  it('reserves a request id and opportunistically deletes expired rows', async () => {
    const mock = createSupabaseMock();

    const result = await reserveAgenticRequestId({
      apiVersion: '2026-04-30',
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req_123',
      supabase: mock.supabase as never,
      now: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(result).toEqual({ ok: true });
    expect(mock.from).toHaveBeenCalledWith('agentic_request_records');
    expect(mock.deleteEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mock.deleteLt).toHaveBeenCalledWith(
      'expires_at',
      '2026-04-30T12:00:00.000Z'
    );
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        api_version: '2026-04-30',
        expires_at: '2026-04-30T12:15:00.000Z',
        idempotency_key: 'idem-1',
        merchant_id: 'merchant-1',
        request_id: 'req_123',
      })
    );
  });

  it('rejects duplicate request ids as replay attempts', async () => {
    const mock = createSupabaseMock({
      insertError: { code: '23505', message: 'duplicate key' },
    });

    const result = await reserveAgenticRequestId({
      apiVersion: '2026-04-30',
      merchantId: 'merchant-1',
      requestId: 'req_123',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({
      error: AGENTIC_REPLAY_REQUEST_ID_ERROR,
      ok: false,
    });
  });

  it('fails closed when expired request record purge fails', async () => {
    const mock = createSupabaseMock({
      deleteError: { code: 'PGRST000', message: 'database unavailable' },
    });

    const result = await reserveAgenticRequestId({
      apiVersion: '2026-04-30',
      merchantId: 'merchant-1',
      requestId: 'req_123',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({
      error: AGENTIC_REPLAY_RESERVATION_FAILED_ERROR,
      ok: false,
    });
    expect(mock.insert).not.toHaveBeenCalled();
  });
});
