import { describe, expect, it, vi } from 'vitest';
import { checkPaymentStatusForTenant } from './chat-check-payment-status';
import type { ChatToolTenantClient } from './chat-tool-result-types';

describe('checkPaymentStatusForTenant', () => {
  it('reports a paid order from the scoped session row', async () => {
    const result = {
      data: {
        id: 'order-1',
        status: 'paid',
        paid_at: '2026-07-26T00:00:00.000Z',
        created_at: '2026-07-26T00:00:00.000Z',
        subtotal: 5000,
        virtual_account_number: null,
        virtual_account_bank: null,
        metadata: null,
      },
      error: null,
    };
    const query = Object.assign(Promise.resolve(result), {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
    });
    const scoped = {
      merchantId: 'merchant-1',
      supabase: { from: vi.fn(() => query) } as never,
    } satisfies ChatToolTenantClient;

    const response = await checkPaymentStatusForTenant(
      { orderId: 'order-1' },
      'session-1',
      scoped
    );

    expect(response).toEqual({
      status: 'paid',
      orderId: 'order-1',
      paidAt: '2026-07-26T00:00:00.000Z',
      amount: 5000,
    });
  });
});
