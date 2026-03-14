import { describe, expect, it } from 'vitest';
import { walletTransactionsQuerySchema } from './wallet-transactions-query';

describe('walletTransactionsQuerySchema', () => {
  it('defaults page and limit when omitted', () => {
    expect(walletTransactionsQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('caps the page size at 100', () => {
    expect(
      walletTransactionsQuerySchema.parse({
        limit: '500',
      })
    ).toEqual({
      page: 1,
      limit: 100,
    });
  });

  it('accepts the supported transaction types', () => {
    expect(
      walletTransactionsQuerySchema.parse({
        type: 'debit',
      })
    ).toEqual({
      page: 1,
      limit: 20,
      type: 'debit',
    });
  });

  it('rejects invalid query values', () => {
    const result = walletTransactionsQuerySchema.safeParse({
      page: '0',
      type: 'refund',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Number must be greater than or equal to 1');
      expect(messages).toContain(
        "Invalid enum value. Expected 'credit' | 'debit' | 'withdrawal' | 'payout', received 'refund'"
      );
    }
  });
});
