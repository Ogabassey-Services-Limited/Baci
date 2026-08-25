import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/types/supabase';
import { persistPaystackDvaAssignment } from './persist-paystack-dva-assignment';

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mockLoggerError },
}));

function createSupabase(error: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ upsert });
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    upsert,
  };
}

const assignment = {
  accountName: 'Baci/Ada',
  accountNumber: '0123456789',
  amount: 5000,
  bankName: 'Wema Bank',
  orderId: '550e8400-e29b-41d4-a716-446655440000',
};

describe('persistPaystackDvaAssignment', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('persists the Paystack account with a 90-minute assignment window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T12:00:00.000Z'));
    const { client, from, upsert } = createSupabase();

    const result = await persistPaystackDvaAssignment(client, assignment);

    expect(result).toBeNull();
    expect(from).toHaveBeenCalledWith('order_payment_accounts');
    expect(upsert).toHaveBeenCalledWith(
      {
        account_name: 'Baci/Ada',
        account_number: '0123456789',
        assigned_at: '2026-08-25T12:00:00.000Z',
        bank_name: 'Wema Bank',
        expires_at: '2026-08-25T13:30:00.000Z',
        order_id: assignment.orderId,
        payable_amount: 5000,
        provider: 'paystack',
      },
      { onConflict: 'order_id,provider' }
    );
  });

  it('returns a retryable error response when persistence fails', async () => {
    const databaseError = { message: 'write failed' };
    const { client } = createSupabase(databaseError);

    const result = await persistPaystackDvaAssignment(client, assignment);

    expect(result?.status).toBe(503);
    expect(await result?.json()).toEqual({
      code: 'DVA_PERSISTENCE_FAILED',
      error:
        'Unable to reserve a bank account for this order. Please try again.',
    });
    expect(mockLoggerError).toHaveBeenCalledWith({
      error: databaseError,
      message: 'Failed to persist Paystack DVA assignment',
      orderId: assignment.orderId,
    });
  });
});
