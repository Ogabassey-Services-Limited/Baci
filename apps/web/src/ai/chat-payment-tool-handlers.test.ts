import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createScoped: vi.fn(),
}));

vi.mock('@/lib/agentic/agentic-scoped-chat-client', () => ({
  createAgenticScopedChatClient: mocks.createScoped,
}));

import {
  handleCheckPaymentStatus,
  handleCreateVirtualAccount,
} from './chat-payment-tool-handlers';

type QueryResult = { data: unknown; error?: unknown };

function scopedClient(chatOrder: QueryResult) {
  const query = Object.assign(Promise.resolve(chatOrder), {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(chatOrder)),
    maybeSingle: vi.fn(() => Promise.resolve(chatOrder)),
  });
  return {
    merchantId: 'merchant-1',
    supabase: { from: vi.fn(() => query) },
  };
}

describe('chat payment tool handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fails closed when the copilot tenant is unresolvable', () => {
    it('handleCreateVirtualAccount returns an error without writing an order', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.createScoped.mockResolvedValue(null);

      const result = await handleCreateVirtualAccount(
        {
          items: [{ productId: 'p1', name: 'Phone', price: 1000, quantity: 1 }],
          amount: 1000,
          customerEmail: 'a@b.test',
          customerName: 'A',
        },
        'session-1'
      );

      expect(result).toEqual({
        success: false,
        error: 'Failed to create order',
      });
    });

    it('handleCheckPaymentStatus returns not_found', async () => {
      mocks.createScoped.mockResolvedValue(null);

      const result = await handleCheckPaymentStatus(
        { orderId: 'order-1' },
        'session-1'
      );

      expect(result).toEqual({ status: 'not_found' });
    });
  });

  it('reports a paid order from the scoped session row', async () => {
    mocks.createScoped.mockResolvedValue(
      scopedClient({
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
      })
    );

    const result = await handleCheckPaymentStatus(
      { orderId: 'order-1' },
      'session-1'
    );

    expect(result).toEqual({
      status: 'paid',
      orderId: 'order-1',
      paidAt: '2026-07-26T00:00:00.000Z',
      amount: 5000,
    });
  });

  it('blocks virtual-account creation while Kuda is not integrated (no fake account)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.createScoped.mockResolvedValue(
      scopedClient({ data: { id: 'order-9' }, error: null })
    );

    const result = await handleCreateVirtualAccount(
      {
        items: [{ productId: 'p1', name: 'Phone', price: 1000, quantity: 2 }],
        amount: 2000,
        customerEmail: 'a@b.test',
        customerName: 'A',
      },
      'session-1'
    );

    expect(result.success).toBe(false);
    expect(result.orderId).toBe('order-9');
    expect(result.error).toContain('temporarily unavailable');
  });
});
