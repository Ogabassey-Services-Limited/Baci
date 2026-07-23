// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findGrandfatheredAgenticPaystackDvaReplay } from './agentic-paystack-dva-grandfathered-replay';
import { resolveGrandfatheredPaymentPendingReplay } from './agentic-paystack-dva-grandfathered-response';

vi.mock('server-only', () => ({}));
vi.mock('./agentic-paystack-dva-grandfathered-response', () => ({
  resolveGrandfatheredPaymentPendingReplay: vi.fn(),
}));

function createSupabaseMock({
  data = [],
  error = null,
}: {
  data?: unknown[];
  error?: unknown;
} = {}) {
  const chain = {
    contains: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    limit: vi.fn(),
    order: vi.fn(),
  };
  chain.contains.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gt.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockResolvedValue({ data, error });

  const select = vi.fn(() => chain);
  const supabase = { from: vi.fn(() => ({ select })) };
  return { chain, select, supabase };
}

const session = {
  currency: 'NGN',
  session_id: 'agentic_session_1',
};

describe('findGrandfatheredAgenticPaystackDvaReplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the exact validated stored response', async () => {
    const rows = [
      {
        request_hash: 'a'.repeat(64),
        response_body: { id: 'agentic_session_1', version: 1 },
        status_code: 200,
      },
      {
        request_hash: 'b'.repeat(64),
        response_body: { id: 'agentic_session_1', version: 2 },
        status_code: 200,
      },
    ];
    const mock = createSupabaseMock({ data: rows });
    const validated = { body: rows[1]?.response_body, status: 200 as const };
    vi.mocked(resolveGrandfatheredPaymentPendingReplay)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(validated);

    const result = await findGrandfatheredAgenticPaystackDvaReplay({
      merchantId: 'merchant-1',
      now: new Date('2026-07-19T12:00:00.000Z'),
      session,
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ data: validated, error: null });
    expect(mock.supabase.from).toHaveBeenCalledWith(
      'agentic_idempotency_records'
    );
    expect(mock.select).toHaveBeenCalledWith(
      'request_hash, response_body, status_code'
    );
    expect(mock.chain.eq).toHaveBeenCalledWith(
      'route',
      'checkout_sessions.complete'
    );
    expect(mock.chain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mock.chain.eq).toHaveBeenCalledWith('status_code', 200);
    expect(mock.chain.gt).toHaveBeenCalledWith(
      'expires_at',
      '2026-07-19T12:00:00.000Z'
    );
    expect(mock.chain.contains).toHaveBeenCalledWith('response_body', {
      id: 'agentic_session_1',
      status: 'ready_for_payment',
    });
  });

  it('fails closed when no stored response validates', async () => {
    const row = {
      request_hash: 'a'.repeat(64),
      response_body: { id: 'agentic_session_1' },
      status_code: 200,
    };
    const mock = createSupabaseMock({ data: [row] });
    vi.mocked(resolveGrandfatheredPaymentPendingReplay).mockReturnValue(null);

    await expect(
      findGrandfatheredAgenticPaystackDvaReplay({
        merchantId: 'merchant-1',
        session,
        supabase: mock.supabase as never,
      })
    ).resolves.toEqual({ data: null, error: null });
  });

  it('returns lookup errors without exposing a response', async () => {
    const error = { code: '42501', message: 'denied' };
    const mock = createSupabaseMock({ error });

    await expect(
      findGrandfatheredAgenticPaystackDvaReplay({
        merchantId: 'merchant-1',
        session,
        supabase: mock.supabase as never,
      })
    ).resolves.toEqual({ data: null, error });
    expect(resolveGrandfatheredPaymentPendingReplay).not.toHaveBeenCalled();
  });
});
