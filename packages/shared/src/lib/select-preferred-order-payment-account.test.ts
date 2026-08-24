import { describe, expect, it } from 'vitest';
import { selectPreferredOrderPaymentAccount } from './select-preferred-order-payment-account';

const account = (
  provider: string,
  accountNumber: string,
  createdAt: string
) => ({
  account_name: 'Merchant',
  account_number: accountNumber,
  bank_name: 'Bank',
  created_at: createdAt,
  provider,
});

describe('selectPreferredOrderPaymentAccount', () => {
  it('prefers Paystack when legacy provider rows coexist', () => {
    const selected = selectPreferredOrderPaymentAccount([
      account('korapay', '1111111111', '2026-08-24T12:00:00.000Z'),
      account('paystack', '2222222222', '2026-08-24T11:00:00.000Z'),
    ]);

    expect(selected?.account_number).toBe('2222222222');
  });

  it('uses the newest non-Paystack row when no Paystack row exists', () => {
    const selected = selectPreferredOrderPaymentAccount([
      account('korapay', '1111111111', '2026-08-24T11:00:00.000Z'),
      account('korapay', '2222222222', '2026-08-24T12:00:00.000Z'),
    ]);

    expect(selected?.account_number).toBe('2222222222');
  });

  it('returns null for an empty account list', () => {
    expect(selectPreferredOrderPaymentAccount([])).toBeNull();
  });
});
