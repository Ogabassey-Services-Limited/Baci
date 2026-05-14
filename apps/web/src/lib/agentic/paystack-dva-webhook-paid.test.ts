import { describe, expect, it, vi } from 'vitest';
import { confirmAgenticPaystackDvaPayment } from '@/lib/agentic/paystack-dva-webhook';

const makeSupabase = (overrides?: {
  transactionData?: Record<string, unknown> | null;
  transactionError?: { message: string } | null;
  upsertError?: { message: string } | null;
}) => {
  const {
    transactionData = null,
    transactionError = null,
    upsertError = null,
  } = overrides ?? {};
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: transactionData, error: transactionError });
  const upsertChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: upsertError }),
  };
  const from = vi.fn((table: string) => {
    if (table === 'transactions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle,
      };
    }
    return {
      upsert: vi.fn(() => upsertChain),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
  return { from };
};

describe('confirmAgenticPaystackDvaPayment', () => {
  it('returns handled:false when accountNumber is null', async () => {
    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: null,
      gatewayReference: 'ref-1',
      supabase: makeSupabase() as never,
      verifiedAmount: { amount: 1000 },
    });
    expect(result).toEqual({ handled: false });
  });

  it('returns handled:false when accountNumber does not match pattern', async () => {
    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: 'ABC',
      gatewayReference: 'ref-1',
      supabase: makeSupabase() as never,
      verifiedAmount: { amount: 1000 },
    });
    expect(result).toEqual({ handled: false });
  });

  it('returns 500 when transaction lookup errors', async () => {
    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: '1234567890',
      gatewayReference: 'ref-1',
      supabase: makeSupabase({
        transactionError: { message: 'db error' },
      }) as never,
      verifiedAmount: { amount: 1000 },
    });
    expect(result).toMatchObject({ handled: true, status: 500 });
  });

  it('returns handled:false when no transaction matches the account', async () => {
    const result = await confirmAgenticPaystackDvaPayment({
      accountNumber: '1234567890',
      gatewayReference: 'ref-1',
      supabase: makeSupabase({ transactionData: null }) as never,
      verifiedAmount: { amount: 1000 },
    });
    expect(result).toEqual({ handled: false });
  });
});
