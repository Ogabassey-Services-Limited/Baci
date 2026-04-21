import { describe, expect, it } from 'vitest';
import { orderDetailsRouteParamsSchema } from './order-details-route-params';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('orderDetailsRouteParamsSchema', () => {
  it('parses a valid UUID id with no action', () => {
    const result = orderDetailsRouteParamsSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID);
      expect(result.data.action).toBeUndefined();
    }
  });

  it('parses a valid UUID id with action record-payment', () => {
    const result = orderDetailsRouteParamsSchema.safeParse({
      id: VALID_UUID,
      action: 'record-payment',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('record-payment');
    }
  });

  it('parses a valid UUID id with action ship-on-credit', () => {
    const result = orderDetailsRouteParamsSchema.safeParse({
      id: VALID_UUID,
      action: 'ship-on-credit',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('ship-on-credit');
    }
  });

  it('fails when id is the string "new" (not a UUID)', () => {
    const result = orderDetailsRouteParamsSchema.safeParse({ id: 'new' });
    expect(result.success).toBe(false);
  });

  it('fails when id is missing', () => {
    const result = orderDetailsRouteParamsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails when action is an invalid enum value', () => {
    const result = orderDetailsRouteParamsSchema.safeParse({
      id: VALID_UUID,
      action: 'unknown-action',
    });
    expect(result.success).toBe(false);
  });

  it('fails when id is not a valid UUID format', () => {
    const result = orderDetailsRouteParamsSchema.safeParse({
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});
