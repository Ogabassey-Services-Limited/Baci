import { describe, expect, it } from 'vitest';
import {
  GetOrderInputSchema,
  GetOrdersInputSchema,
  ResendOrderConfirmationInputSchema,
} from './dashboard-order-actions';

describe('dashboard order action schemas', () => {
  it('defaults optional order filters to an empty object', () => {
    expect(GetOrdersInputSchema.parse({ merchantId: ' merchant-1 ' })).toEqual({
      merchantId: 'merchant-1',
      filters: {},
    });
  });

  it('rejects empty merchant and order identifiers', () => {
    expect(() => GetOrdersInputSchema.parse({ merchantId: ' ' })).toThrow();
    expect(() =>
      GetOrderInputSchema.parse({
        merchantId: 'merchant-1',
        orderIdentifier: '',
      })
    ).toThrow();
  });

  it('validates resend confirmation order ids as UUIDs', () => {
    expect(
      ResendOrderConfirmationInputSchema.safeParse({ orderId: 'not-a-uuid' })
        .success
    ).toBe(false);
  });
});
