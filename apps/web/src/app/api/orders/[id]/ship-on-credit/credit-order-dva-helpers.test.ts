import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/paystack', () => ({
  generatePaymentAccount: vi.fn(),
}));
vi.mock('@/lib/payments/persist-paystack-dva-assignment', () => ({
  persistPaystackDvaAssignment: vi.fn(),
}));

import { persistPaystackDvaAssignment } from '@/lib/payments/persist-paystack-dva-assignment';
import { generatePaymentAccount } from '@/lib/paystack';
import { creditOrderDvaHelpers } from './credit-order-dva-helpers';

describe('creditOrderDvaHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an explicitly expired Paystack account', () => {
    expect(
      creditOrderDvaHelpers.isReusableAccount({
        account_name: 'Old customer',
        account_number: '0123456789',
        assigned_at: '2020-01-01T00:00:00.000Z',
        bank_name: 'Wema Bank',
        expires_at: '2020-01-01T00:30:00.000Z',
        provider: 'paystack',
      })
    ).toBe(false);
  });

  it('accepts a Paystack account with a future explicit expiry', () => {
    expect(
      creditOrderDvaHelpers.isReusableAccount({
        account_name: 'Current customer',
        account_number: '0123456789',
        bank_name: 'Wema Bank',
        expires_at: '2999-01-01T00:00:00.000Z',
        provider: 'paystack',
      })
    ).toBe(true);
  });

  it('splits customer names and supplies safe fallbacks', () => {
    expect(creditOrderDvaHelpers.toCustomerName('Ada Lovelace')).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(creditOrderDvaHelpers.toCustomerName(null)).toEqual({
      firstName: 'Customer',
      lastName: 'User',
    });
  });

  it('maps a persisted DVA to the public response shape', () => {
    expect(
      creditOrderDvaHelpers.toVirtualAccount({
        account_name: 'Baci / Ada',
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      })
    ).toEqual({
      account_name: 'Baci / Ada',
      account_number: '1234567890',
      bank_name: 'Paystack-Titan',
    });
  });

  it('keeps credit-order DVA reservations alive through the persisted due date', async () => {
    vi.mocked(generatePaymentAccount).mockResolvedValue({
      success: true,
      data: {
        account_name: 'Baci / Ada',
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
        customer_code: 'CUS_ada',
      },
    });
    vi.mocked(persistPaystackDvaAssignment).mockResolvedValue(null);

    await creditOrderDvaHelpers.provisionCreditOrderDva({
      customerEmail: 'ada@example.com',
      customerName: 'Ada Lovelace',
      orderId: 'order-1',
      paymentDueDate: '2026-08-28',
      supabase: {} as SupabaseClient,
      now: new Date('2026-08-27T12:00:00.000Z'),
    });

    expect(persistPaystackDvaAssignment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        expiresAt: '2026-08-29T00:00:00.000Z',
      })
    );
  });

  it('uses an explicit fourteen-day credit term when the due date is missing or stale', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');

    expect(creditOrderDvaHelpers.getCreditOrderDvaExpiry(null, now)).toBe(
      '2026-09-10T12:00:00.000Z'
    );
    expect(
      creditOrderDvaHelpers.getCreditOrderDvaExpiry('2026-08-26', now)
    ).toBe('2026-09-10T12:00:00.000Z');
  });
});
