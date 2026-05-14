import { describe, expect, it } from 'vitest';
import { shipOnCreditResponseSchema } from './ship-on-credit-response';

function createShipOnCreditPayload() {
  return {
    success: true,
    message: 'Order confirmed for credit shipping',
    order: {
      id: 'order-1',
      order_number: 'ORD-1',
      shipping_status: 'processing',
      is_credit_order: true,
    },
    virtualAccount: null,
  };
}

describe('shipOnCreditResponseSchema', () => {
  it('accepts successful ship-on-credit responses with no virtual account', () => {
    const result = shipOnCreditResponseSchema.safeParse(
      createShipOnCreditPayload()
    );

    expect(result.success).toBe(true);
  });

  it('accepts successful ship-on-credit responses with virtual account details', () => {
    const result = shipOnCreditResponseSchema.safeParse({
      success: true,
      message: 'Order confirmed for credit shipping',
      order: {
        id: 'order-1',
        order_number: null,
        shipping_status: 'processing',
        is_credit_order: true,
      },
      virtualAccount: {
        account_name: 'Ada Customer',
        account_number: '1234567890',
        bank_name: 'Paystack Bank',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed ship-on-credit responses', () => {
    const result = shipOnCreditResponseSchema.safeParse({
      success: true,
      message: 'Order confirmed for credit shipping',
      order: {
        id: 'order-1',
        shipping_status: 'processing',
        is_credit_order: 'yes',
      },
      virtualAccount: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['order', 'is_credit_order'],
          }),
        ])
      );
    }
  });

  it.each([
    ['missing success field', { message: 'ok' }],
    [
      'invalid success field type',
      { ...createShipOnCreditPayload(), success: 'true' },
    ],
    ['empty message', { ...createShipOnCreditPayload(), message: '' }],
    [
      'missing order id',
      {
        ...createShipOnCreditPayload(),
        order: {
          ...createShipOnCreditPayload().order,
          id: undefined,
        },
      },
    ],
    [
      'empty order id',
      {
        ...createShipOnCreditPayload(),
        order: {
          ...createShipOnCreditPayload().order,
          id: '',
        },
      },
    ],
    [
      'invalid shipping status',
      {
        ...createShipOnCreditPayload(),
        order: {
          ...createShipOnCreditPayload().order,
          shipping_status: 'not-real',
        },
      },
    ],
    [
      'malformed virtual account',
      {
        ...createShipOnCreditPayload(),
        virtualAccount: {
          account_name: 'Ada Customer',
          bank_name: 'Paystack Bank',
        },
      },
    ],
  ])('rejects %s', (_name, payload) => {
    const result = shipOnCreditResponseSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });
});
