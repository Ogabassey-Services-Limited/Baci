import { describe, expect, it, vi } from 'vitest';
import { loadOrderGiglInternalCreditRetainedAmount } from './load-order-gigl-internal-credit-retained-amount';

function mockTransactions(
  rows: Array<{ gateway: string; status: string; amount: number }>
) {
  return vi.fn((table: string) => {
    if (table === 'transactions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn().mockResolvedValue({
                  data: rows,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe('loadOrderGiglInternalCreditRetainedAmount', () => {
  it('sums completed wallet payment amounts as retention evidence', async () => {
    const from = mockTransactions([
      { gateway: 'wallet', status: 'completed', amount: 2500 },
    ]);

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
    const from = mockTransactions([
      { gateway: 'store_credit', status: 'completed', amount: 1800 },
    ]);

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
    const from = mockTransactions([
      { gateway: 'wallet', status: 'completed', amount: 500 },
    ]);

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

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('transactions');
    expect(from).not.toHaveBeenCalledWith('orders');
  });

  it('returns 0 when no internal-credit payment exists', async () => {
    const from = mockTransactions([]);

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
