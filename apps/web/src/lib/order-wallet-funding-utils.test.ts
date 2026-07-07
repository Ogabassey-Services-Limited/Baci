import { describe, expect, it } from 'vitest';
import {
  baseIntent,
  intent,
} from '@/lib/order-wallet-funding-intents.test-utils';
import {
  amountFitsIntent,
  buildWalletFundingIntentIdempotencyKey,
  INTENT_TTL_MS,
  isOrderPayable,
  ONE_KOBO,
  PAYABLE_STATUSES,
  paidAtFitsIntent,
  roundMoney,
} from '@/lib/order-wallet-funding-utils';

describe('order wallet funding utilities', () => {
  it('rounds money through minor units', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(12.345)).toBe(12.35);
  });

  it('rounds edge-case money values consistently', () => {
    expect(roundMoney(0)).toBe(0);
    expect(roundMoney(-0.1)).toBe(-0.1);
    expect(roundMoney(Number.EPSILON)).toBe(0);
    expect(roundMoney(999_999_999.999)).toBe(1_000_000_000);
    expect(roundMoney(0.004)).toBe(0);
    expect(roundMoney(0.005)).toBe(0.01);
    expect(roundMoney(0.015)).toBe(0.02);
  });

  it('builds deterministic idempotency keys', () => {
    expect(
      buildWalletFundingIntentIdempotencyKey({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        startedAt: new Date('2026-05-26T12:00:00.000Z'),
      })
    ).toBe(
      'order-wallet-funding:order-1:merchant-1:customer-1:2026-05-26T12:00:00.000Z'
    );
  });

  it('builds idempotency keys for boundary ids and normalized dates', () => {
    expect(
      buildWalletFundingIntentIdempotencyKey({
        customerId: '',
        merchantId: '',
        orderId: '',
        startedAt: new Date(0),
      })
    ).toBe('order-wallet-funding::::1970-01-01T00:00:00.000Z');
    expect(
      buildWalletFundingIntentIdempotencyKey({
        customerId: 'customer:emoji-😀',
        merchantId: 'merchant/slash',
        orderId: 'order:1/2',
        startedAt: new Date('2026-05-26T13:00:00.000+01:00'),
      })
    ).toBe(
      'order-wallet-funding:order:1/2:merchant/slash:customer:emoji-😀:2026-05-26T12:00:00.000Z'
    );
    expect(
      buildWalletFundingIntentIdempotencyKey({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        startedAt: new Date('9999-12-31T23:59:59.999Z'),
      })
    ).toBe(
      'order-wallet-funding:order-1:merchant-1:customer-1:9999-12-31T23:59:59.999Z'
    );
  });

  it('throws when an idempotency key receives an invalid date at runtime', () => {
    expect(() =>
      buildWalletFundingIntentIdempotencyKey({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        startedAt: null as never,
      })
    ).toThrow('startedAt must be a valid Date');
    expect(() =>
      buildWalletFundingIntentIdempotencyKey({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        startedAt: new Date('not-a-date'),
      })
    ).toThrow('startedAt must be a valid Date');
  });

  it('checks order status and paid window compatibility', () => {
    const intent = baseIntent();

    for (const status of PAYABLE_STATUSES) {
      expect(isOrderPayable(status)).toBe(true);
    }
    expect(isOrderPayable('cancelled')).toBe(false);
    expect(isOrderPayable('paid')).toBe(false);
    expect(isOrderPayable('refunded')).toBe(false);
    expect(paidAtFitsIntent(intent, new Date('2026-05-26T12:00:00.000Z'))).toBe(
      true
    );
    expect(paidAtFitsIntent(intent, new Date('2026-05-26T12:05:00.000Z'))).toBe(
      true
    );
    expect(paidAtFitsIntent(intent, new Date('2026-05-26T12:29:59.999Z'))).toBe(
      true
    );
    expect(paidAtFitsIntent(intent, new Date('2026-05-26T12:30:00.000Z'))).toBe(
      false
    );
  });

  it('checks full-cover amount compatibility with the one-kobo tolerance', () => {
    const fundingIntent = intent({
      expectedAmount: 20_000,
      fundedAmount: 5_000,
    });

    expect(amountFitsIntent(fundingIntent, 15_000)).toBe(true);
    expect(amountFitsIntent(fundingIntent, 15_000 - ONE_KOBO)).toBe(true);
    expect(amountFitsIntent(fundingIntent, 15_000 - ONE_KOBO * 2)).toBe(false);
    expect(amountFitsIntent(fundingIntent, 50_000)).toBe(true);
    expect(
      amountFitsIntent(intent({ expectedAmount: 0, fundedAmount: 0 }), 0)
    ).toBe(true);
    expect(
      amountFitsIntent(
        intent({ expectedAmount: 15_000, fundedAmount: 20_000 }),
        0
      )
    ).toBe(true);
  });

  it('checks paid windows on exact boundaries', () => {
    const createdAt = '2026-05-26T12:00:00.000Z';
    const expiresAt = new Date(
      new Date(createdAt).getTime() + INTENT_TTL_MS
    ).toISOString();
    const fundingIntent = intent({
      createdAt,
      expectedAmount: 20_000,
      expiresAt,
      fundedAmount: 5_000,
    });

    expect(paidAtFitsIntent(fundingIntent, new Date(createdAt))).toBe(true);
    expect(paidAtFitsIntent(fundingIntent, new Date(expiresAt))).toBe(false);
    expect(
      paidAtFitsIntent(
        fundingIntent,
        new Date(new Date(createdAt).getTime() - 1)
      )
    ).toBe(false);
  });

  it('rejects paid-window comparisons with invalid dates', () => {
    const validIntent = baseIntent();

    expect(paidAtFitsIntent(validIntent, new Date('invalid'))).toBe(false);
    expect(
      paidAtFitsIntent(
        intent({ createdAt: 'invalid-date' }),
        new Date('2026-05-26T12:05:00.000Z')
      )
    ).toBe(false);
    expect(
      paidAtFitsIntent(
        intent({ expiresAt: 'invalid-date' }),
        new Date('2026-05-26T12:05:00.000Z')
      )
    ).toBe(false);
  });
});
