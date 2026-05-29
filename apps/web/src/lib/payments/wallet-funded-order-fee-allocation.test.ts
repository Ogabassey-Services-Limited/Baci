import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
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
    eq,
    from,
    orderFirst,
    orderSecond,
    select,
  };
}

describe('getWalletFundedOrderAllocatedGatewayFee', () => {
  it('allocates only the fee attached to funds used for the expected shortfall', async () => {
    const supabase = createSupabaseMock({
      data: [
        { amount: 10_000, gateway_fee: 100, id: 'payment-1' },
        { amount: 10_000, gateway_fee: 100, id: 'payment-2' },
      ],
    });

    const allocated = await getWalletFundedOrderAllocatedGatewayFee({
      fallbackFee: 300,
      intent,
      supabase: supabase.client,
    });

    expect(allocated).toBe(150);
  });

  it('falls back to the verified fee when payment rows are unavailable', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const supabase = createSupabaseMock({ error: { message: 'unavailable' } });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(300);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        intentId: 'intent-1',
        message:
          'Falling back to verified gateway fee for wallet-funded order allocation',
      })
    );
    warn.mockRestore();
  });

  it('falls back when payment row data is not an array', async () => {
    const supabase = createSupabaseMock({
      data: { amount: 15_000, gateway_fee: 150 },
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(300);
  });

  it('falls back when payment row data is null', async () => {
    const supabase = createSupabaseMock({
      data: null,
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(300);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
  ])('sanitizes malformed fallback fees like %s', async (fallbackFee) => {
    const supabase = createSupabaseMock({ error: { message: 'unavailable' } });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(0);
  });

  it('falls back when no payment rows are available', async () => {
    const supabase = createSupabaseMock({ data: [] });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(300);
  });

  it('falls back without querying when the intent id is missing', async () => {
    const supabase = createSupabaseMock({
      data: [{ amount: 15_000, gateway_fee: 150, id: 'payment-1' }],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent: { ...intent, id: '' },
        supabase: supabase.client,
      })
    ).resolves.toBe(300);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('falls back when every payment row is unusable', async () => {
    const supabase = createSupabaseMock({
      data: [
        null,
        'not-a-row',
        { gateway_fee: 50, id: 'payment-missing-amount' },
        { amount: 5000, id: 'payment-missing-fee' },
        { amount: null, gateway_fee: 50, id: 'payment-null-amount' },
        { amount: 5000, gateway_fee: null, id: 'payment-null-fee' },
        { amount: 0, gateway_fee: 50, id: 'payment-zero-amount' },
        { amount: -5000, gateway_fee: 50, id: 'payment-negative-amount' },
        {
          amount: Number.POSITIVE_INFINITY,
          gateway_fee: 50,
          id: 'payment-infinite-amount',
        },
        { amount: 'invalid', gateway_fee: 50, id: 'payment-invalid-amount' },
      ],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(300);
  });

  it.each([
    0,
    -1,
    Number.NaN,
  ])('falls back when the expected amount is %s', async (expectedAmount) => {
    const supabase = createSupabaseMock({
      data: [{ amount: 15_000, gateway_fee: 150, id: 'payment-1' }],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent: { ...intent, expectedAmount },
        supabase: supabase.client,
      })
    ).resolves.toBe(300);
  });

  it('ignores non-finite gateway fees and keeps usable payment rows', async () => {
    const supabase = createSupabaseMock({
      data: [
        { amount: 5_000, gateway_fee: Number.NaN, id: 'payment-nan-fee' },
        {
          amount: 5_000,
          gateway_fee: Number.POSITIVE_INFINITY,
          id: 'payment-infinite-fee',
        },
        { amount: 15_000, gateway_fee: 150, id: 'payment-valid' },
      ],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(150);
  });

  it('ignores negative gateway fees', async () => {
    const supabase = createSupabaseMock({
      data: [
        { amount: 5_000, gateway_fee: -50, id: 'payment-negative-fee' },
        { amount: 15_000, gateway_fee: 150, id: 'payment-valid' },
      ],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(150);
  });

  it('uses the full gateway fee when one payment covers the expected amount', async () => {
    const supabase = createSupabaseMock({
      data: [{ amount: 15_000, gateway_fee: 150, id: 'payment-1' }],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(150);
  });

  it('stops allocating once the expected amount is fully covered', async () => {
    const supabase = createSupabaseMock({
      data: [
        { amount: 15_000, gateway_fee: 150, id: 'payment-covering' },
        { amount: 10_000, gateway_fee: 10_000, id: 'payment-after-cover' },
      ],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(150);
  });

  it('ignores zero-fee and invalid-amount payment rows', async () => {
    const supabase = createSupabaseMock({
      data: [
        { amount: 0, gateway_fee: 100, id: 'payment-invalid' },
        { amount: 10_000, gateway_fee: 0, id: 'payment-zero-fee' },
        { amount: 5_000, gateway_fee: 50, id: 'payment-valid' },
      ],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(50);
  });

  it('preserves a valid zero total gateway fee instead of falling back', async () => {
    const supabase = createSupabaseMock({
      data: [{ amount: 15_000, gateway_fee: 0, id: 'payment-zero-fee' }],
    });

    await expect(
      getWalletFundedOrderAllocatedGatewayFee({
        fallbackFee: 300,
        intent,
        supabase: supabase.client,
      })
    ).resolves.toBe(0);
  });
});
