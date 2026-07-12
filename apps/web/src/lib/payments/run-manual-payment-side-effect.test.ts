import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runManualPaymentSideEffect } from './run-manual-payment-side-effect';

const mockSingle = vi.fn();
const mockRpc = vi.fn();
const supabase: Pick<SupabaseClient, 'rpc'> = { rpc: mockRpc };

describe('runManualPaymentSideEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockImplementation(() => ({ single: mockSingle }));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs and completes a newly claimed side effect', async () => {
    mockSingle.mockResolvedValue({ data: { we_won: true }, error: null });
    mockRpc
      .mockImplementationOnce(() => ({ single: mockSingle }))
      .mockResolvedValueOnce({ data: true, error: null });
    const execute = vi.fn().mockResolvedValue(undefined);

    await expect(
      runManualPaymentSideEffect({
        actor: 'user-1',
        execute,
        orderId: 'order-1',
        step: 'partial_receipt',
        supabase,
        transactionId: 'transaction-1',
      })
    ).resolves.toBe('completed');
    expect(execute).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenLastCalledWith(
      'finish_manual_payment_side_effect',
      expect.objectContaining({ p_status: 'completed' })
    );
  });

  it('defers when another request owns the claim', async () => {
    mockSingle.mockResolvedValue({
      data: { current_status: 'claimed', we_won: false },
      error: null,
    });
    const execute = vi.fn();
    await expect(
      runManualPaymentSideEffect({
        actor: 'user-1',
        execute,
        orderId: 'order-1',
        step: 'partial_receipt',
        supabase,
        transactionId: 'transaction-1',
      })
    ).resolves.toBe('deferred');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not rerun an already completed side effect', async () => {
    mockSingle.mockResolvedValue({
      data: { current_status: 'completed', we_won: false },
      error: null,
    });
    const execute = vi.fn();

    await expect(
      runManualPaymentSideEffect({
        actor: 'user-1',
        execute,
        orderId: 'order-1',
        step: 'partial_receipt',
        supabase,
        transactionId: 'transaction-1',
      })
    ).resolves.toBe('deferred');
    expect(execute).not.toHaveBeenCalled();
  });

  it('keeps the executor untouched when claiming fails', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });
    const execute = vi.fn();

    await expect(
      runManualPaymentSideEffect({
        actor: 'user-1',
        execute,
        orderId: 'order-1',
        step: 'partial_receipt',
        supabase,
        transactionId: 'transaction-1',
      })
    ).resolves.toBe('failed');
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns failed without executing when the claim RPC throws', async () => {
    mockSingle.mockRejectedValueOnce(new Error('connection closed'));
    const execute = vi.fn();

    await expect(
      runManualPaymentSideEffect({
        actor: 'user-1',
        execute,
        orderId: 'order-1',
        step: 'partial_receipt',
        supabase,
        transactionId: 'transaction-1',
      })
    ).resolves.toBe('failed');
    expect(execute).not.toHaveBeenCalled();
  });

  it('marks a failed executor for a later replay', async () => {
    mockSingle.mockResolvedValue({ data: { we_won: true }, error: null });
    mockRpc
      .mockImplementationOnce(() => ({ single: mockSingle }))
      .mockResolvedValueOnce({ data: true, error: null });
    await expect(
      runManualPaymentSideEffect({
        actor: 'user-1',
        execute: () => Promise.reject(new Error('email unavailable')),
        orderId: 'order-1',
        step: 'partial_receipt',
        supabase,
        transactionId: 'transaction-1',
      })
    ).resolves.toBe('failed');
    expect(mockRpc).toHaveBeenLastCalledWith(
      'finish_manual_payment_side_effect',
      expect.objectContaining({
        p_error: 'email unavailable',
        p_status: 'failed',
      })
    );
  });

  it('reports failed when a successful effect cannot be finalized', async () => {
    mockSingle.mockResolvedValue({ data: { we_won: true }, error: null });
    mockRpc
      .mockImplementationOnce(() => ({ single: mockSingle }))
      .mockResolvedValueOnce({
        data: false,
        error: { message: 'write lost' },
      });
    const execute = vi.fn().mockResolvedValue(undefined);

    await expect(
      runManualPaymentSideEffect({
        actor: 'user-1',
        execute,
        orderId: 'order-1',
        step: 'partial_receipt',
        supabase,
        transactionId: 'transaction-1',
      })
    ).resolves.toBe('failed');
    expect(execute).toHaveBeenCalledOnce();
  });

  it('contains finalization errors after a failed executor', async () => {
    mockSingle.mockResolvedValue({ data: { we_won: true }, error: null });
    mockRpc
      .mockImplementationOnce(() => ({ single: mockSingle }))
      .mockRejectedValueOnce(new Error('connection closed'));

    await expect(
      runManualPaymentSideEffect({
        actor: 'user-1',
        execute: () => Promise.reject(new Error('email unavailable')),
        orderId: 'order-1',
        step: 'partial_receipt',
        supabase,
        transactionId: 'transaction-1',
      })
    ).resolves.toBe('failed');
  });
});
