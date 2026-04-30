import { describe, expect, it, vi } from 'vitest';
import {
  hashIdempotencyRequest,
  reserveAgenticIdempotencyKey,
  storeAgenticIdempotencyResponse,
} from '@/lib/agentic/idempotency';

const defaultFingerprint = {
  apiVersion: '2026-04-30',
  method: 'POST',
  pathname: '/api/agentic/checkout_sessions',
};

function createSupabaseMock({
  existingRecord = null,
  insertError = null,
  selectError = null,
  updateData = { id: 'idem-record-1' },
  updateError = null,
}: {
  existingRecord?: Record<string, unknown> | null;
  insertError?: { code?: string; message?: string } | null;
  selectError?: { code?: string; message?: string } | null;
  updateData?: Record<string, unknown> | null;
  updateError?: { code?: string; message?: string } | null;
} = {}) {
  const deleteEq = vi.fn();
  const deleteLt = vi.fn().mockResolvedValue({ error: null });
  const deleteChain = {
    eq: deleteEq,
    lt: deleteLt,
  };
  deleteEq.mockReturnValue(deleteChain);
  const maybeSingle = vi.fn().mockResolvedValue({
    data: selectError ? null : existingRecord,
    error: selectError,
  });
  const selectChain = {
    eq: vi.fn(),
    maybeSingle,
  };
  selectChain.eq.mockReturnValue(selectChain);

  const insertSelect = vi.fn(() => ({
    maybeSingle: vi.fn().mockResolvedValue({
      data: insertError ? null : { id: 'idem-record-1' },
      error: insertError,
    }),
  }));
  const updateEq = vi.fn();
  const updateChain = {
    eq: updateEq,
    maybeSingle: vi.fn().mockResolvedValue({
      data: updateError ? null : updateData,
      error: updateError,
    }),
    select: vi.fn(),
  };
  updateEq.mockReturnValue(updateChain);
  updateChain.select.mockReturnValue(updateChain);
  const from = vi.fn(() => ({
    delete: vi.fn(() => deleteChain),
    insert: vi.fn(() => ({ select: insertSelect })),
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
  }));

  return {
    from,
    deleteEq,
    deleteLt,
    maybeSingle,
    supabase: { from },
    updateChain,
    updateEq,
  };
}

describe('agentic idempotency', () => {
  it('reserves a new idempotency key before mutation', async () => {
    const mock = createSupabaseMock();
    const body = '{"items":[]}';

    const result = await reserveAgenticIdempotencyKey({
      ...defaultFingerprint,
      body,
      key: 'idem-1',
      merchantId: 'merchant-1',
      route: 'checkout_sessions.create',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ ok: true, state: 'reserved' });
    expect(mock.from).toHaveBeenCalledWith('agentic_idempotency_records');
  });

  it('replays a stored response when key and request hash match', async () => {
    const body = '{"items":[]}';
    const mock = createSupabaseMock({
      existingRecord: {
        request_hash: hashIdempotencyRequest({
          ...defaultFingerprint,
          body,
        }),
        response_body: { id: 'session-1' },
        status_code: 201,
      },
      insertError: { code: '23505', message: 'duplicate key' },
    });

    const result = await reserveAgenticIdempotencyKey({
      ...defaultFingerprint,
      body,
      key: 'idem-1',
      merchantId: 'merchant-1',
      route: 'checkout_sessions.create',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({
      ok: true,
      response: { id: 'session-1' },
      state: 'replay',
      status: 201,
    });
  });

  it('returns conflict when the key is reused with a different body', async () => {
    const mock = createSupabaseMock({
      existingRecord: {
        request_hash: hashIdempotencyRequest({
          ...defaultFingerprint,
          body: '{"items":[]}',
        }),
        response_body: { id: 'session-1' },
        status_code: 201,
      },
      insertError: { code: '23505', message: 'duplicate key' },
    });

    const result = await reserveAgenticIdempotencyKey({
      ...defaultFingerprint,
      body: '{"items":[{"id":"changed"}]}',
      key: 'idem-1',
      merchantId: 'merchant-1',
      route: 'checkout_sessions.create',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ ok: false, error: 'Idempotency conflict' });
  });

  it('returns conflict when the key is reused for a different session path', async () => {
    const body = '{}';
    const mock = createSupabaseMock({
      existingRecord: {
        request_hash: hashIdempotencyRequest({
          apiVersion: '2026-04-30',
          body,
          method: 'POST',
          pathname: '/api/agentic/checkout_sessions/agentic_session_1/cancel',
        }),
        response_body: { id: 'agentic_session_1', status: 'canceled' },
        status_code: 200,
      },
      insertError: { code: '23505', message: 'duplicate key' },
    });

    const result = await reserveAgenticIdempotencyKey({
      apiVersion: '2026-04-30',
      body,
      key: 'idem-1',
      merchantId: 'merchant-1',
      method: 'POST',
      pathname: '/api/agentic/checkout_sessions/agentic_session_2/cancel',
      route: 'checkout_sessions.cancel',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ ok: false, error: 'Idempotency conflict' });
  });

  it('returns reservation failure when the existing record lookup fails', async () => {
    const mock = createSupabaseMock({
      insertError: { code: '23505', message: 'duplicate key' },
      selectError: { code: 'PGRST000', message: 'lookup failed' },
    });

    const result = await reserveAgenticIdempotencyKey({
      ...defaultFingerprint,
      body: '{"items":[]}',
      key: 'idem-1',
      merchantId: 'merchant-1',
      route: 'checkout_sessions.create',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Idempotency reservation failed',
    });
  });

  it('stores the final response for future replay', async () => {
    const mock = createSupabaseMock();

    const result = await storeAgenticIdempotencyResponse({
      key: 'idem-1',
      merchantId: 'merchant-1',
      response: { id: 'session-1' },
      route: 'checkout_sessions.create',
      status: 201,
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ error: null, ok: true });
    expect(mock.updateEq).toHaveBeenCalledWith(
      'route',
      'checkout_sessions.create'
    );
    expect(mock.updateEq).toHaveBeenCalledWith('idempotency_key', 'idem-1');
    expect(mock.updateEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });

  it('returns failure when the response record no longer exists', async () => {
    const mock = createSupabaseMock({ updateData: null });

    const result = await storeAgenticIdempotencyResponse({
      key: 'idem-1',
      merchantId: 'merchant-1',
      response: { id: 'session-1' },
      route: 'checkout_sessions.create',
      status: 201,
      supabase: mock.supabase as never,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });
});
