import { describe, expect, it, vi } from 'vitest';
import { loadOrderGiglInternalCreditRetainedAmount } from './load-order-gigl-internal-credit-retained-amount';

describe('loadOrderGiglInternalCreditRetainedAmount', () => {
  it('returns stamped retention when a completed wallet payment exists', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({
                    data: [{ gateway: 'wallet', status: 'completed' }],
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    shipping_funding_source: 'customer_checkout',
                    shipping_platform_retained_amount: 2500,
                  },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1'
      )
    ).resolves.toBe(2500);
  });

  it('bugfix: treats store_credit and savings payments as retention evidence', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({
                    data: [{ gateway: 'store_credit', status: 'completed' }],
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  shipping_funding_source: 'customer_checkout',
                  shipping_platform_retained_amount: 1800,
                },
                error: null,
              }),
            })),
          })),
        })),
      };
    });

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1'
      )
    ).resolves.toBe(1800);
  });

  it('returns 0 when no internal-credit payment exists', async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        })),
      })),
    }));

    await expect(
      loadOrderGiglInternalCreditRetainedAmount(
        { from } as never,
        'merchant-1',
        'order-1'
      )
    ).resolves.toBe(0);
  });
});
