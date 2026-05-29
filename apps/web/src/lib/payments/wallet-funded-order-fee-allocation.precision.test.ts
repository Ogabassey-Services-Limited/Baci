import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { OrderWalletFundingIntent } from '@/lib/order-wallet-funding-intents';
import { getWalletFundedOrderAllocatedGatewayFee } from '@/lib/payments/wallet-funded-order-fee-allocation';

const intent = {
  expectedAmount: 15_000,
  id: 'intent-1',
} as OrderWalletFundingIntent;

function createSupabaseMock({
  data,
  error = null,
}: {
  data?: unknown;
  error?: unknown;
}) {
  const orderSecond = vi.fn(async () => ({ data, error }));
  const orderFirst = vi.fn(() => ({ order: orderSecond }));
  const eq = vi.fn(() => ({ order: orderFirst }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from } as unknown as SupabaseClient,
  };
}

describe('getWalletFundedOrderAllocatedGatewayFee precision', () => {
  it('rounds fractional proportional fee allocations to money precision', async () => {
    const supabase = createSupabaseMock({
      data: [{ amount: 200.02, gateway_fee: 3.333, id: 'payment-fractional' }],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 10,
        intent: { ...intent, expectedAmount: 100.01 },
        supabase: supabase.client,
      })
    ).resolves.toBe(1.67);
  });

  it('allocates proportionally when a transfer overfunds the expected amount', async () => {
    const supabase = createSupabaseMock({
      data: [{ amount: 30_000, gateway_fee: 300, id: 'payment-overfunded' }],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(150);
  });

  it('never allocates more than the total gateway fee for processed rows', async () => {
    const supabase = createSupabaseMock({
      data: [
        { amount: 10_000, gateway_fee: 33.331, id: 'payment-1' },
        { amount: 10_000, gateway_fee: 33.331, id: 'payment-2' },
      ],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent: { ...intent, expectedAmount: 20_000 },
        supabase: supabase.client,
      })
    ).resolves.toBe(66.66);
  });

  it('uses the fallback fee when payment lookup fails', async () => {
    const supabase = createSupabaseMock({
      error: { message: 'query failed' },
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 99.99,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(99.99);
  });

  it('uses the fallback fee for malformed precision rows', async () => {
    const supabase = createSupabaseMock({
      data: [{ amount: 'bad', gateway_fee: 'bad', id: 'payment-bad' }],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 88.88,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(88.88);
  });
});
