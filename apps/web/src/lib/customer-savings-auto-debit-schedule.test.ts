import { describe, expect, it } from 'vitest';
import {
  getSavingsAutoDebitPeriodKey,
  getSavingsAutoDebitReference,
} from './customer-savings-auto-debit-schedule';

const baseGoal = {
  contribution_amount: '20000',
  contribution_frequency: 'daily' as const,
  current_amount: '0',
  customer_id: 'customer-1',
  id: '11111111-1111-4111-8111-111111111111',
  maturity_date: '2026-06-30',
  merchant_id: 'merchant-1',
  preferred_debit_time: '06:20:00',
  saved_payment_method_id: 'payment-method-1',
  start_date: '2026-05-21',
  target_amount: '800000',
};

describe('customer savings auto-debit schedule helpers', () => {
  it('waits until the Lagos preferred debit time', () => {
    expect(
      getSavingsAutoDebitPeriodKey(
        baseGoal,
        new Date('2026-05-21T04:59:00.000Z')
      )
    ).toBeNull();
    expect(
      getSavingsAutoDebitPeriodKey(
        baseGoal,
        new Date('2026-05-21T05:20:00.000Z')
      )
    ).toBe('2026-05-21');
  });

  it('creates a deterministic Paystack-safe reference', () => {
    expect(getSavingsAutoDebitReference(baseGoal.id, '2026-05-21')).toBe(
      'SVG-111111111111-2026-05-21'
    );
  });

  it('only charges weekly goals on seven-day cycle boundaries', () => {
    const weeklyGoal = {
      ...baseGoal,
      contribution_frequency: 'weekly' as const,
      start_date: '2026-05-21',
    };

    expect(
      getSavingsAutoDebitPeriodKey(
        weeklyGoal,
        new Date('2026-05-27T07:30:00.000Z')
      )
    ).toBeNull();
    expect(
      getSavingsAutoDebitPeriodKey(
        weeklyGoal,
        new Date('2026-05-28T07:30:00.000Z')
      )
    ).toBe('2026-05-28');
  });

  it('only charges monthly goals on their start day of month', () => {
    const monthlyGoal = {
      ...baseGoal,
      contribution_frequency: 'monthly' as const,
      start_date: '2026-05-21',
    };

    expect(
      getSavingsAutoDebitPeriodKey(
        monthlyGoal,
        new Date('2026-06-20T07:30:00.000Z')
      )
    ).toBeNull();
    expect(
      getSavingsAutoDebitPeriodKey(
        monthlyGoal,
        new Date('2026-06-21T07:30:00.000Z')
      )
    ).toBe('2026-06');
  });

  it('charges monthly goals on the last day when the start day does not exist', () => {
    const monthlyGoal = {
      ...baseGoal,
      contribution_frequency: 'monthly' as const,
      start_date: '2026-01-31',
    };

    expect(
      getSavingsAutoDebitPeriodKey(
        monthlyGoal,
        new Date('2026-02-27T07:30:00.000Z')
      )
    ).toBeNull();
    expect(
      getSavingsAutoDebitPeriodKey(
        monthlyGoal,
        new Date('2026-02-28T07:30:00.000Z')
      )
    ).toBe('2026-02');
    expect(
      getSavingsAutoDebitPeriodKey(
        monthlyGoal,
        new Date('2026-04-30T07:30:00.000Z')
      )
    ).toBe('2026-04');
  });
});
