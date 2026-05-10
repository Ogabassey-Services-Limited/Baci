import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeAgenticIdempotencyResponse } from '@/lib/agentic/idempotency';
import {
  buildPersistedAgenticIdempotencyResponse,
  buildStoredAgenticIdempotencyResponse,
  persistAgenticIdempotencyResponse,
} from '@/lib/agentic/idempotency-response-storage';

vi.mock('@/lib/agentic/idempotency', () => ({
  storeAgenticIdempotencyResponse: vi.fn(),
}));

describe('buildStoredAgenticIdempotencyResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores and returns the original response with replay headers', async () => {
    const supabase = {} as never;
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.create',
      status: 201,
      supabase,
    });

    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith({
      key: 'idem-1',
      merchantId: 'merchant-1',
      response: { ok: true },
      route: 'checkout_sessions.create',
      status: 201,
      supabase,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('idempotency-key')).toBe('idem-1');
    expect(response.headers.get('request-id')).toBe('req-1');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('fails closed when replay persistence fails for a non-server-error response', async () => {
    const supabase = {} as never;
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: new Error('write failed'),
      ok: false,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.create',
      status: 200,
      supabase,
    });

    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith({
      key: 'idem-1',
      merchantId: 'merchant-1',
      response: { ok: true },
      route: 'checkout_sessions.create',
      status: 200,
      supabase,
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('idempotency-key')).toBe('idem-1');
    expect(response.headers.get('request-id')).toBe('req-1');
    expect(response.headers.get('x-idempotency-warning')).toBe(
      'response-not-stored'
    );
    await expect(response.json()).resolves.toEqual({
      error: 'Idempotency response storage failed',
    });
  });

  it('returns the default storage failure response when a server-error response cannot be stored', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: new Error('write failed'),
      ok: false,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { error: 'Database error' },
      route: 'checkout_sessions.create',
      status: 500,
      supabase: {} as never,
    });

    expect(response.status).toBe(503);
    expect(response.headers.get('idempotency-key')).toBe('idem-1');
    expect(response.headers.get('request-id')).toBe('req-1');
    expect(response.headers.get('x-idempotency-warning')).toBe(
      'response-not-stored'
    );
    await expect(response.json()).resolves.toEqual({
      error: 'Idempotency response storage failed',
    });
  });

  it('returns the custom storage failure response when replay persistence throws', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockRejectedValue(
      new Error('write threw')
    );

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { error: 'Database error' },
      route: 'checkout_sessions.create',
      status: 500,
      storageFailureResponse: { error: 'custom storage failure' },
      supabase: {} as never,
    });

    expect(response.status).toBe(503);
    expect(response.headers.get('idempotency-key')).toBe('idem-1');
    expect(response.headers.get('request-id')).toBe('req-1');
    expect(response.headers.get('x-idempotency-warning')).toBe(
      'response-not-stored'
    );
    await expect(response.json()).resolves.toEqual({
      error: 'custom storage failure',
    });
  });

  it('returns the custom storage failure response for successful side effects without durable replay storage', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: new Error('write failed'),
      ok: false,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.create',
      status: 201,
      storageFailureResponse: { error: 'read session to recover' },
      supabase: {} as never,
    });

    expect(response.status).toBe(503);
    expect(response.headers.get('idempotency-key')).toBe('idem-1');
    expect(response.headers.get('request-id')).toBe('req-1');
    expect(response.headers.get('x-idempotency-warning')).toBe(
      'response-not-stored'
    );
    await expect(response.json()).resolves.toEqual({
      error: 'read session to recover',
    });
  });

  it('coerces invalid response statuses before storage and response creation', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { error: 'Invalid status' },
      route: 'checkout_sessions.create',
      status: 700,
      supabase: {} as never,
    });

    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 })
    );
    expect(response.status).toBe(500);
  });

  it('coerces informational response statuses before storage and response creation', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { error: 'Invalid status' },
      route: 'checkout_sessions.create',
      status: 100,
      supabase: {} as never,
    });

    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 })
    );
    expect(response.status).toBe(500);
  });

  it('coerces the highest informational response status before storage and response creation', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { error: 'Invalid status' },
      route: 'checkout_sessions.create',
      status: 199,
      supabase: {} as never,
    });

    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 })
    );
    expect(response.status).toBe(500);
  });

  it('preserves the lowest valid JSON response status', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.create',
      status: 200,
      supabase: {} as never,
    });

    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200 })
    );
    expect(response.status).toBe(200);
  });

  it('preserves the highest valid HTTP response status', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });

    const response = await buildStoredAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.create',
      status: 599,
      supabase: {} as never,
    });

    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 599 })
    );
    expect(response.status).toBe(599);
  });
});

describe('persistAgenticIdempotencyResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok:true when the underlying store succeeds', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });

    const result = await persistAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.complete',
      status: 200,
      supabase: {} as never,
    });

    expect(result).toEqual({ ok: true });
    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith({
      key: 'idem-1',
      merchantId: 'merchant-1',
      response: { ok: true },
      route: 'checkout_sessions.complete',
      status: 200,
      supabase: {},
    });
  });

  it('returns ok:false with the error when the underlying store fails', async () => {
    const storeError = new Error('write failed');
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: storeError,
      ok: false,
    });

    const result = await persistAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.complete',
      status: 200,
      supabase: {} as never,
    });

    expect(result).toEqual({ error: storeError, ok: false });
  });

  it('returns ok:false when the underlying store throws (network/parse failure)', async () => {
    const thrown = new Error('write threw');
    vi.mocked(storeAgenticIdempotencyResponse).mockRejectedValue(thrown);

    const result = await persistAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.complete',
      status: 200,
      supabase: {} as never,
    });

    expect(result).toEqual({ error: thrown, ok: false });
  });

  it('coerces an out-of-range status before delegating to the store', async () => {
    vi.mocked(storeAgenticIdempotencyResponse).mockResolvedValue({
      error: null,
      ok: true,
    });

    await persistAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.complete',
      status: 700,
      supabase: {} as never,
    });

    expect(storeAgenticIdempotencyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500 })
    );
  });
});

describe('buildPersistedAgenticIdempotencyResponse', () => {
  it('returns the response with idempotency replay headers and the validated status', async () => {
    const response = buildPersistedAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.complete',
      status: 200,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('idempotency-key')).toBe('idem-1');
    expect(response.headers.get('request-id')).toBe('req-1');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('does not call the storage backend (storage is the caller responsibility)', () => {
    const spy = vi.mocked(storeAgenticIdempotencyResponse);
    spy.mockClear();

    buildPersistedAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.complete',
      status: 200,
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('coerces invalid statuses before building the response', () => {
    const response = buildPersistedAgenticIdempotencyResponse({
      idempotencyKey: 'idem-1',
      merchantId: 'merchant-1',
      requestId: 'req-1',
      response: { ok: true },
      route: 'checkout_sessions.complete',
      status: 700,
    });

    expect(response.status).toBe(500);
  });
});
