import { describe, expect, it, vi } from 'vitest';
import { loadOrderGiglInternalCreditRetainedAmount } from './load-order-gigl-internal-credit-retained-amount';

type TableRows = Record<string, unknown[]>;

function mockFrom(tables: TableRows) {
  return vi.fn((table: string) => {
    const rows = tables[table] ?? [];
    if (table === 'transactions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn().mockResolvedValue({ data: rows, error: null }),
              })),
            })),
          })),
        })),
      };
    }
    if (table === 'customer_wallet_transactions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
              })),
            })),
          })),
        })),
      };
    }
    if (table === 'customer_savings_redemptions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
}

describe('loadOrderGiglInternalCreditRetainedAmount', () => {
  it('sums completed wallet payment amounts as retention evidence', async () => {
    const from = mockFrom({
      transactions: [{ gateway: 'wallet', status: 'completed', amount: 2500 }],
      customer_wallet_transactions: [],
      customer_savings_redemptions: [],
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1',
        {
          shipping_funding_source: 'customer_checkout',
          shipping_platform_retained_amount: 2500,
        }
      )
    ).resolves.toBe(2500);
  });

  it('bugfix: treats store_credit and savings payments as retention evidence', async () => {
    const from = mockFrom({
      transactions: [
        { gateway: 'store_credit', status: 'completed', amount: 1800 },
      ],
      customer_wallet_transactions: [],
      customer_savings_redemptions: [],
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1',
        {
          shipping_funding_source: 'customer_checkout',
          shipping_platform_retained_amount: 1800,
        }
      )
    ).resolves.toBe(1800);
  });

  it('bugfix: caps evidence at credited amounts instead of the full stamped tariff', async () => {
    const from = mockFrom({
      transactions: [{ gateway: 'wallet', status: 'completed', amount: 500 }],
      customer_wallet_transactions: [],
      customer_savings_redemptions: [],
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1',
        {
          shipping_funding_source: 'customer_checkout',
          shipping_platform_retained_amount: 3200,
        }
      )
    ).resolves.toBe(500);

    expect(from).toHaveBeenCalledWith('transactions');
    expect(from).not.toHaveBeenCalledWith('orders');
  });

  it('returns 0 when no internal-credit payment exists', async () => {
    const from = mockFrom({
      transactions: [],
      customer_wallet_transactions: [],
      customer_savings_redemptions: [],
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1',
        {
          shipping_funding_source: 'customer_checkout',
          shipping_platform_retained_amount: 2500,
        }
      )
    ).resolves.toBe(0);
  });

  it('bugfix: includes partial wallet/savings ledgers when finalize transactions are absent', async () => {
    // Mixed checkout: amountDueToGateway > 0 skips finalize_* RPCs, so only
    // redemption ledgers exist for the already-controlled credit portion.
    const from = mockFrom({
      transactions: [],
      customer_wallet_transactions: [
        {
          amount: 800,
          status: 'completed',
          source_type: 'order_redemption',
          source_id: 'order-1',
        },
      ],
      customer_savings_redemptions: [
        {
          amount: 700,
          order_id: 'order-1',
          metadata: {},
        },
      ],
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1',
        {
          shipping_funding_source: 'customer_checkout',
          shipping_platform_retained_amount: 3200,
        }
      )
    ).resolves.toBe(1500);

    expect(from).toHaveBeenCalledWith('customer_wallet_transactions');
    expect(from).toHaveBeenCalledWith('customer_savings_redemptions');
  });

  it('does not double-count ledger and finalize transaction amounts', async () => {
    const from = mockFrom({
      transactions: [{ gateway: 'wallet', status: 'completed', amount: 2500 }],
      customer_wallet_transactions: [
        {
          amount: 2500,
          status: 'completed',
          source_type: 'order_redemption',
          source_id: 'order-1',
        },
      ],
      customer_savings_redemptions: [],
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1',
        {
          shipping_funding_source: 'customer_checkout',
          shipping_platform_retained_amount: 2500,
        }
      )
    ).resolves.toBe(2500);
  });

  it('ignores reversed savings redemptions', async () => {
    const from = mockFrom({
      transactions: [],
      customer_wallet_transactions: [],
      customer_savings_redemptions: [
        {
          amount: 900,
          order_id: 'order-1',
          metadata: { reversed_at: '2026-09-04T00:00:00.000Z' },
        },
      ],
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1',
        {
          shipping_funding_source: 'customer_checkout',
          shipping_platform_retained_amount: 2500,
        }
      )
    ).resolves.toBe(0);
  });
});
