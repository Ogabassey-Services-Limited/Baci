import { describe, expect, it } from 'vitest';
import {
  moneyInputSchema,
  paidOrderSideEffectTransactionSchema,
} from '@/schemas/paid-order-side-effects';

describe('paid order side-effect schemas', () => {
  it('validates payment transaction rows used by paid-order side effects', () => {
    expect(
      paidOrderSideEffectTransactionSchema.parse({
        amount: '20000.50',
        gateway_reference: null,
        id: 'transaction-1',
        merchant_id: 'merchant-1',
        order_id: 'order-1',
        platform_fee: 250,
      })
    ).toMatchObject({
      amount: 20_000.5,
      id: 'transaction-1',
      merchant_id: 'merchant-1',
      order_id: 'order-1',
      platform_fee: 250,
    });
  });

  it('rejects malformed payment transaction rows', () => {
    expect(
      paidOrderSideEffectTransactionSchema.safeParse({
        amount: '',
        gateway_reference: null,
        id: '',
        merchant_id: 'merchant-1',
        order_id: 'order-1',
      }).success
    ).toBe(false);
  });

  it('accepts numeric boundary values and preserves extra fields', () => {
    const parsed = paidOrderSideEffectTransactionSchema.parse({
      amount: 0,
      gateway_reference: undefined,
      id: 'transaction-1',
      merchant_id: 'merchant-1',
      order_id: 'order-1',
      platform_fee: null,
      source: 'wallet_funding',
    });

    expect(parsed).toMatchObject({
      amount: 0,
      gateway_reference: null,
      platform_fee: null,
      source: 'wallet_funding',
    });
  });

  it.each([
    ['0', 0],
    ['1.25', 1.25],
    ['+1.25', 1.25],
    ['999999999999.99', 999_999_999_999.99],
  ])('accepts numeric string amount %s', (amount, expected) => {
    expect(
      paidOrderSideEffectTransactionSchema.parse({
        amount,
        id: 'transaction-1',
        merchant_id: 'merchant-1',
        order_id: 'order-1',
      }).amount
    ).toBe(expected);
  });

  it.each([
    'abc',
    '12abc',
    '1.234',
    '1e10',
    ' 1.25 ',
    ' ',
    Number.POSITIVE_INFINITY,
    1.234,
    1e-7,
    -1,
    '-1.25',
  ])('rejects malformed amount %s', (amount) => {
    expect(
      paidOrderSideEffectTransactionSchema.safeParse({
        amount,
        id: 'transaction-1',
        merchant_id: 'merchant-1',
        order_id: 'order-1',
      }).success
    ).toBe(false);
  });

  it.each([
    0,
    0.29,
    1.5,
    '0',
    '123.45',
  ])('validates money input %s', (amount) => {
    expect(moneyInputSchema.safeParse(amount).success).toBe(true);
  });

  it('coerces valid money strings to numbers', () => {
    expect(moneyInputSchema.parse('20000.50')).toBe(20_000.5);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1.234,
    1e-7,
    '',
    ' ',
    ' 12.34 ',
    '12abc',
    -1,
    '-1',
  ])('rejects money input %s', (amount) => {
    expect(moneyInputSchema.safeParse(amount).success).toBe(false);
  });

  it.each([
    ['undefined', undefined, null],
    ['null', null, null],
    ['string', 'PSK_REF_1', 'PSK_REF_1'],
  ])('normalizes gateway_reference %s', (_label, reference, expected) => {
    expect(
      paidOrderSideEffectTransactionSchema.parse({
        amount: 20_000,
        gateway_reference: reference,
        id: 'transaction-1',
        merchant_id: 'merchant-1',
        order_id: 'order-1',
      }).gateway_reference
    ).toBe(expected);
  });

  it.each([
    'id',
    'merchant_id',
    'order_id',
    'amount',
  ])('rejects missing required field %s', (field) => {
    const payload: Record<string, unknown> = {
      amount: 20_000,
      id: 'transaction-1',
      merchant_id: 'merchant-1',
      order_id: 'order-1',
    };
    delete payload[field];

    expect(
      paidOrderSideEffectTransactionSchema.safeParse(payload).success
    ).toBe(false);
  });

  it('normalizes nullish platform fees and converts non-empty values to numbers', () => {
    for (const [platformFee, expected] of [
      [undefined, undefined],
      [null, null],
      ['12.50', 12.5],
      [12.5, 12.5],
    ] as const) {
      expect(
        paidOrderSideEffectTransactionSchema.parse({
          amount: 20_000,
          id: 'transaction-1',
          merchant_id: 'merchant-1',
          order_id: 'order-1',
          platform_fee: platformFee,
        }).platform_fee
      ).toBe(expected);
    }
  });
});
