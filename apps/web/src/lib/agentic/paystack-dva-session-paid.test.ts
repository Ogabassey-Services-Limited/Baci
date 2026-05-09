import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { markAgenticPaystackDvaSessionPaid } from '@/lib/agentic/paystack-dva-session-paid';

const validSession = {
  metadata: {
    agentic: {
      dva_account: { account_number: '9930000902' },
      payment_state: 'payment_pending',
    },
  },
  status: 'processing',
};

const validTransaction = {
  merchant_id: 'merchant-1',
  metadata: {
    agentic_checkout_session_id: 'agentic_session_1',
    agentic_virtual_account_number: '9930000902',
    transaction_type: 'agentic_checkout_payment',
  },
  order_id: 'order-1',
};

function createMockSupabase({
  readData = validSession,
  readError = null,
  updateData = { session_id: 'agentic_session_1' },
  updateError = null,
}: {
  readData?: unknown;
  readError?: unknown;
  updateData?: unknown;
  updateError?: unknown;
} = {}) {
  const readChain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: readData,
      error: readError,
    }),
  };
  readChain.eq.mockReturnValue(readChain);

  const updateChain = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: updateData,
      error: updateError,
    }),
    neq: vi.fn(),
    select: vi.fn(),
  };
  updateChain.eq.mockReturnValue(updateChain);
  updateChain.neq.mockReturnValue(updateChain);
  updateChain.select.mockReturnValue(updateChain);

  const update = vi.fn(() => updateChain);
  const from = vi.fn(() => ({ select: vi.fn(() => readChain), update }));

  return {
    from,
    readChain,
    supabase: { from } as unknown as SupabaseClient,
    update,
    updateChain,
  };
}

describe('markAgenticPaystackDvaSessionPaid', () => {
  it('marks the agentic checkout session paid after the standard webhook path settles', async () => {
    const { supabase, update, updateChain } = createMockSupabase();

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: validTransaction,
    });

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          agentic: expect.objectContaining({ payment_state: 'paid' }),
        }),
        status: 'completed',
      })
    );
    expect(updateChain.neq).toHaveBeenCalledWith('status', 'completed');
  });

  it('returns non-ok when the paid session update fails', async () => {
    const { supabase } = createMockSupabase({
      updateData: null,
      updateError: { message: 'update failed' },
    });

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: validTransaction,
    });

    expect(result).toEqual({ error: 'update failed', ok: false });
  });

  it('skips when the checkout session is concurrently completed before update', async () => {
    const { supabase } = createMockSupabase({
      updateData: null,
      updateError: null,
    });

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: validTransaction,
    });

    expect(result).toEqual({ ok: true, skipped: true });
  });

  it('does not update when the checkout session is missing', async () => {
    const { supabase, update } = createMockSupabase({ readData: null });

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: validTransaction,
    });

    expect(result).toEqual({
      error: 'Agentic checkout session not found',
      ok: false,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('skips idempotently when the checkout session is already completed', async () => {
    const { supabase, update } = createMockSupabase({
      readData: { ...validSession, status: 'completed' },
    });

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: validTransaction,
    });

    expect(result).toEqual({ ok: true, skipped: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('skips malformed session metadata without updating', async () => {
    const { supabase, update } = createMockSupabase({
      readData: { metadata: { agentic: {} }, status: 'processing' },
    });

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: validTransaction,
    });

    expect(result).toEqual({ ok: true, skipped: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('skips when the session DVA account does not match the transaction metadata', async () => {
    const { supabase, update } = createMockSupabase({
      readData: {
        metadata: {
          agentic: {
            dva_account: { account_number: '0000000000' },
            payment_state: 'payment_pending',
          },
        },
        status: 'processing',
      },
    });

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: validTransaction,
    });

    expect(result).toEqual({ ok: true, skipped: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('returns a string error when the session read fails', async () => {
    const { supabase, update } = createMockSupabase({
      readData: null,
      readError: { message: 'read failed' },
    });

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: validTransaction,
    });

    expect(result).toEqual({ error: 'read failed', ok: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects agentic transaction metadata without an order id', async () => {
    const { supabase, update } = createMockSupabase();

    const result = await markAgenticPaystackDvaSessionPaid({
      gatewayReference: 'paystack-ref-1',
      supabase,
      transaction: { ...validTransaction, order_id: '  ' },
    });

    expect(result).toEqual({
      error: 'Invalid agentic payment transaction metadata',
      ok: false,
    });
    expect(update).not.toHaveBeenCalled();
  });
});
