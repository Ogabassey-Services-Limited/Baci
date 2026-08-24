import { describe, expect, it } from 'vitest';
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
});
