import { describe, expect, it } from 'vitest';
import { selectReminderPaymentAccount } from './select-reminder-payment-account';

describe('selectReminderPaymentAccount', () => {
  it('uses a legacy account instead of an expired Paystack alias', () => {
    const account = selectReminderPaymentAccount(
      [
        {
          account_name: 'Expired Paystack',
          account_number: '1111111111',
          assigned_at: '2026-08-24T08:00:00.000Z',
          bank_name: 'Paystack Bank',
          created_at: '2026-08-24T08:00:00.000Z',
          expires_at: '2026-08-24T09:30:00.000Z',
          provider: 'paystack',
        },
        {
          account_name: 'Legacy Account',
          account_number: '2222222222',
          bank_name: 'Legacy Bank',
          created_at: '2026-08-23T08:00:00.000Z',
          provider: 'korapay',
        },
      ],
      new Date('2026-08-24T10:00:00.000Z')
    );

    expect(account?.account_number).toBe('2222222222');
  });
});
