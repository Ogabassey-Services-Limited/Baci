import { describe, expect, it } from 'vitest';
import { orderGiglQuoteSchema } from './order-gigl-shipping';

describe('orderGiglQuoteSchema', () => {
  it('accepts a complete receiver override', () => {
    expect(
      orderGiglQuoteSchema.safeParse({
        receiver: {
          address: '1 Main',
          city: 'Lagos',
          state: 'Lagos',
          phone: '0800',
        },
      }).success
    ).toBe(true);
  });

  it('rejects partial or blank overrides', () => {
    expect(
      orderGiglQuoteSchema.safeParse({
        receiver: {
          address: '1 Main',
          city: '',
          state: 'Lagos',
          phone: '0800',
        },
      }).success
    ).toBe(false);
    expect(
      orderGiglQuoteSchema.safeParse({
        receiver: { address: '1 Main', city: 'Lagos' },
      }).success
    ).toBe(false);
  });
});
