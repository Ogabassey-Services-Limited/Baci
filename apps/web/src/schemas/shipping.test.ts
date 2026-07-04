import { describe, expect, it } from 'vitest';
import { SelfFulfillmentSchema, SelfFulfillmentUpdateSchema } from './shipping';

const ORDER_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('SelfFulfillmentSchema dispatchPhone (optional rider number)', () => {
  it('accepts a payload with no dispatchPhone', () => {
    const result = SelfFulfillmentSchema.safeParse({ orderId: ORDER_ID });
    expect(result.success).toBe(true);
  });

  it('accepts an empty dispatchPhone', () => {
    const result = SelfFulfillmentSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a full dispatchPhone', () => {
    const result = SelfFulfillmentSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '08034444444',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a partial dispatchPhone (provided but too short)', () => {
    const result = SelfFulfillmentSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '0803',
    });
    expect(result.success).toBe(false);
  });
});

describe('SelfFulfillmentUpdateSchema dispatchPhone (optional rider number)', () => {
  it('accepts an empty dispatchPhone', () => {
    const result = SelfFulfillmentUpdateSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a partial dispatchPhone (provided but too short)', () => {
    const result = SelfFulfillmentUpdateSchema.safeParse({
      orderId: ORDER_ID,
      dispatchPhone: '0803',
    });
    expect(result.success).toBe(false);
  });
});
