import { describe, expect, it, vi } from 'vitest';
import {
  buildVtuCashbackSummaryBody,
  chunkVtuCashbackSummaryRows,
  getPreviousCalendarMonthPeriod,
  getVtuCashbackSummaryIdempotencyKey,
  groupVtuCashbackSummaryRows,
  markVtuCashbackTransactionsSummarized,
} from '@/lib/vtu-cashback-summary';

describe('getPreviousCalendarMonthPeriod', () => {
  it('returns the previous calendar month in UTC', () => {
    expect(
      getPreviousCalendarMonthPeriod(new Date('2026-04-27T12:00:00Z'))
    ).toEqual({
      endIso: '2026-04-01T00:00:00.000Z',
      label: 'March 2026',
      period: '2026-03',
      startIso: '2026-03-01T00:00:00.000Z',
    });
  });

  it('handles January by returning December of the previous year', () => {
    expect(
      getPreviousCalendarMonthPeriod(new Date('2026-01-15T09:00:00Z'))
    ).toMatchObject({
      endIso: '2026-01-01T00:00:00.000Z',
      label: 'December 2025',
      period: '2025-12',
      startIso: '2025-12-01T00:00:00.000Z',
    });
  });

  it('returns the prior month at the first millisecond of a month', () => {
    expect(
      getPreviousCalendarMonthPeriod(new Date('2026-04-01T00:00:00.000Z'))
    ).toMatchObject({
      endIso: '2026-04-01T00:00:00.000Z',
      label: 'March 2026',
      period: '2026-03',
      startIso: '2026-03-01T00:00:00.000Z',
    });
  });
});

describe('groupVtuCashbackSummaryRows', () => {
  it('returns an empty group list when there are no rows', () => {
    expect(groupVtuCashbackSummaryRows([], '2026-03')).toEqual([]);
  });

  it('groups unprocessed customer cashback rows by customer and merchant', () => {
    const rows = [
      {
        amount: 500,
        customer: { first_name: 'Ada', user_id: 'user-1' },
        customer_id: 'customer-1',
        id: 'tx-1',
        merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
        merchant_id: 'merchant-1',
        metadata: {},
      },
      {
        amount: '250.5',
        customer: { first_name: 'Ada', user_id: 'user-1' },
        customer_id: 'customer-1',
        id: 'tx-2',
        merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
        merchant_id: 'merchant-1',
        metadata: {},
      },
      {
        amount: 999,
        customer: { first_name: 'Ada', user_id: 'user-1' },
        customer_id: 'customer-1',
        id: 'tx-3',
        merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
        merchant_id: 'merchant-1',
        metadata: { monthlySummaryPeriod: '2026-03' },
      },
    ];

    expect(groupVtuCashbackSummaryRows(rows, '2026-03')).toEqual([
      {
        amount: 750.5,
        customerFirstName: 'Ada',
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        merchantName: 'OgaBassey',
        merchantSlug: 'ogabassey',
        transactionCount: 2,
        transactionIds: ['tx-1', 'tx-2'],
        userId: 'user-1',
      },
    ]);
  });

  it('returns an empty group list when all rows are already summarized', () => {
    expect(
      groupVtuCashbackSummaryRows(
        [
          {
            amount: 500,
            customer: { first_name: 'Ada', user_id: 'user-1' },
            customer_id: 'customer-1',
            id: 'tx-1',
            merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
            merchant_id: 'merchant-1',
            metadata: { monthlySummaryPeriod: '2026-03' },
          },
        ],
        '2026-03'
      )
    ).toEqual([]);
  });

  it('keeps different customer and merchant pairs separate', () => {
    const groups = groupVtuCashbackSummaryRows(
      [
        {
          amount: 500,
          customer: { first_name: 'Ada', user_id: 'user-1' },
          customer_id: 'customer-1',
          id: 'tx-1',
          merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
          merchant_id: 'merchant-1',
          metadata: {},
        },
        {
          amount: 300,
          customer: { first_name: 'Ben', user_id: 'user-2' },
          customer_id: 'customer-2',
          id: 'tx-2',
          merchant: { business_name: 'Other Store', slug: 'other-store' },
          merchant_id: 'merchant-2',
          metadata: {},
        },
      ],
      '2026-03'
    );

    expect(groups).toEqual([
      expect.objectContaining({
        amount: 500,
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        transactionIds: ['tx-1'],
      }),
      expect.objectContaining({
        amount: 300,
        customerId: 'customer-2',
        merchantId: 'merchant-2',
        transactionIds: ['tx-2'],
      }),
    ]);
  });
});

describe('buildVtuCashbackSummaryBody', () => {
  it('uses the merchant name, amount, purchase count, and month label', () => {
    expect(
      buildVtuCashbackSummaryBody({
        amount: 1750,
        customerFirstName: 'Ada',
        merchantName: 'OgaBassey',
        periodLabel: 'March 2026',
        transactionCount: 3,
      })
    ).toBe(
      'Ada, OgaBassey added ₦1,750 to your wallet from 3 bill purchases in March 2026.'
    );
  });

  it('uses singular copy for one bill purchase', () => {
    expect(
      buildVtuCashbackSummaryBody({
        amount: 500,
        customerFirstName: 'Ada',
        merchantName: 'OgaBassey',
        periodLabel: 'March 2026',
        transactionCount: 1,
      })
    ).toBe(
      'Ada, OgaBassey added ₦500 to your wallet from 1 bill purchase in March 2026.'
    );
  });
});

describe('getVtuCashbackSummaryIdempotencyKey', () => {
  it('builds a deterministic customer merchant period key', () => {
    expect(
      getVtuCashbackSummaryIdempotencyKey({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        period: '2026-03',
      })
    ).toBe('vtu-cashback-summary:2026-03:customer-1:merchant-1');
  });
});

describe('chunkVtuCashbackSummaryRows', () => {
  it('chunks rows by the requested batch size', () => {
    expect(chunkVtuCashbackSummaryRows([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });
});

describe('markVtuCashbackTransactionsSummarized', () => {
  it('marks only the requested transaction rows', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const supabase = {
      from: vi.fn().mockReturnValue({ update }),
    };
    const rows = [
      {
        amount: 500,
        customer: { first_name: 'Ada', user_id: 'user-1' },
        customer_id: 'customer-1',
        id: 'tx-1',
        merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
        merchant_id: 'merchant-1',
        metadata: {},
      },
      {
        amount: 300,
        customer: { first_name: 'Ada', user_id: 'user-1' },
        customer_id: 'customer-1',
        id: 'tx-2',
        merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
        merchant_id: 'merchant-1',
        metadata: {},
      },
    ];

    await expect(
      markVtuCashbackTransactionsSummarized(supabase, rows, ['tx-1'], '2026-03')
    ).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          monthlySummaryPeriod: '2026-03',
          monthlySummaryStatus: 'sent',
        }),
      })
    );
    expect(eq).toHaveBeenCalledWith('id', 'tx-1');
    expect(eq).not.toHaveBeenCalledWith('id', 'tx-2');
  });
});
