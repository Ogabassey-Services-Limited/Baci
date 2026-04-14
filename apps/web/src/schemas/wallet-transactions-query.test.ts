import { describe, expect, it } from 'vitest';
import { walletTransactionsQuerySchema } from '@/schemas/wallet-transactions-query';

const supportedTransactionTypes = [
  'credit',
  'debit',
  'withdrawal',
  'payout',
  'refund',
  'adjustment',
] as const;

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

  it('coerces page and limit boundary values', () => {
    expect(
      walletTransactionsQuerySchema.parse({
        page: '1',
        limit: '1',
      })
    ).toEqual({
      page: 1,
      limit: 1,
    });

    expect(
      walletTransactionsQuerySchema.parse({
        page: 1,
        limit: 100,
      })
    ).toEqual({
      page: 1,
      limit: 100,
    });
  });

  it('accepts all supported transaction types', () => {
    for (const type of supportedTransactionTypes) {
      expect(
        walletTransactionsQuerySchema.parse({
          type,
        })
      ).toEqual({
        page: 1,
        limit: 20,
        type,
      });
    }
  });

  it('rejects invalid query values', () => {
    const result = walletTransactionsQuerySchema.safeParse({
      page: '0',
      type: 'transfer',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/>=1|greater than or equal to 1/),
          expect.stringMatching(/Invalid enum value|expected one of/),
        ])
      );
    }
  });
});
