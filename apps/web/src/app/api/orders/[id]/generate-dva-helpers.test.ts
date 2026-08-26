import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { generateDvaHelpers } from './generate-dva-helpers';

describe('generateDvaHelpers', () => {
  it('accepts only collectible, non-cancelled orders', () => {
    expect(
      generateDvaHelpers.isEligibleOrderForPaystackDva({
        payment_status: 'partially_paid',
        shipping_status: 'pending',
      })
    ).toBe(true);
    expect(
      generateDvaHelpers.isEligibleOrderForPaystackDva({
        payment_status: 'refunded',
        shipping_status: 'pending',
      })
    ).toBe(false);
    expect(
      generateDvaHelpers.isEligibleOrderForPaystackDva({
        payment_status: 'unpaid',
        shipping_status: 'cancelled',
      })
    ).toBe(false);
  });

  it('stops advertising a Paystack account after its assignment window', () => {
    const assignedAt = new Date('2026-08-24T10:00:00.000Z');
    const account = {
      account_name: 'Merchant',
      account_number: '1234567890',
      assigned_at: assignedAt.toISOString(),
      bank_name: 'Bank',
      provider: 'paystack',
    };

    expect(
      generateDvaHelpers.isActivePaymentAccount(
        account,
        new Date(assignedAt.getTime() + 89 * 60 * 1000)
      )
    ).toBe(true);
    expect(
      generateDvaHelpers.isActivePaymentAccount(
        account,
        new Date(assignedAt.getTime() + 91 * 60 * 1000)
      )
    ).toBe(false);
  });

  it('honors an explicit invoice expiry beyond the default assignment window', () => {
    expect(
      generateDvaHelpers.isActivePaymentAccount(
        {
          assigned_at: '2026-08-24T10:00:00.000Z',
          provider: 'paystack',
          expires_at: '2026-08-25T00:00:00.000Z',
        },
        new Date('2026-08-24T12:00:00.000Z')
      )
    ).toBe(true);
  });

  it('recognizes a Postgres unique conflict for concurrent provisioning', () => {
    expect(generateDvaHelpers.isUniqueViolation({ code: '23505' })).toBe(true);
    expect(generateDvaHelpers.isUniqueViolation({ code: '42501' })).toBe(false);
  });

  it('builds customer names and the protected assignment window', () => {
    expect(generateDvaHelpers.toCustomerName('Ada Lovelace')).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(
      generateDvaHelpers.createAssignmentWindow(
        new Date('2026-08-24T10:00:00.000Z')
      )
    ).toEqual({
      assignedAt: '2026-08-24T10:00:00.000Z',
      expiresAt: '2026-08-24T11:30:00.000Z',
    });
  });

  it('loads the latest Paystack account with deterministic assignment ordering', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const query = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle,
      select: vi.fn().mockReturnThis(),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient;

    await generateDvaHelpers.loadLatestPaystackOrderAccount(
      supabase,
      'order-1'
    );

    expect(supabase.from).toHaveBeenCalledWith('order_payment_accounts');
    expect(query.select).toHaveBeenCalledWith(
      'account_number, bank_name, account_name, provider, created_at, assigned_at, expires_at'
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, 'order_id', 'order-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'provider', 'paystack');
    expect(query.order).toHaveBeenNthCalledWith(1, 'assigned_at', {
      ascending: false,
      nullsFirst: false,
    });
    expect(query.order).toHaveBeenNthCalledWith(2, 'created_at', {
      ascending: false,
    });
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(maybeSingle).toHaveBeenCalledOnce();
  });
});
