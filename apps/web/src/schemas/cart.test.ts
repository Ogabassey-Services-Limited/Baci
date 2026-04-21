import { describe, expect, it } from 'vitest';
import { cartValidateSchema } from '@/schemas/cart';

describe('cartValidateSchema', () => {
  it('accepts valid input with productIds array', () => {
    const result = cartValidateSchema.safeParse({
      productIds: ['abc-123', 'def-456'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productIds).toEqual(['abc-123', 'def-456']);
    }
  });

  it('accepts valid input with cartItems array', () => {
    const result = cartValidateSchema.safeParse({
      cartItems: [
        { id: 'item-1', price: 1500 },
        { id: 'item-2', price: 2500 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cartItems).toHaveLength(2);
    }
  });

  it('accepts valid input with both productIds and cartItems', () => {
    const result = cartValidateSchema.safeParse({
      productIds: ['abc-123'],
      cartItems: [{ id: 'item-1', price: 1000 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with neither field (both are optional)', () => {
    const result = cartValidateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.productIds).toBeUndefined();
      expect(result.data.cartItems).toBeUndefined();
    }
  });

  it('rejects input when productIds is not an array', () => {
    const result = cartValidateSchema.safeParse({
      productIds: 'not-an-array',
    });
    expect(result.success).toBe(false);
  });

  it('rejects input when a cartItems entry is missing the required id field', () => {
    const result = cartValidateSchema.safeParse({
      cartItems: [{ price: 1500 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects input when a cartItems entry has price as a string instead of number', () => {
    const result = cartValidateSchema.safeParse({
      cartItems: [{ id: 'item-1', price: '1500' }],
    });
    expect(result.success).toBe(false);
  });
});
