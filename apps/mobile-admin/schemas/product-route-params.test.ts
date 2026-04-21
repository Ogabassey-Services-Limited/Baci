import { describe, expect, it } from 'vitest';
import { routeParamsSchema } from './product-route-params';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('routeParamsSchema', () => {
  it('parses the new-product route id', () => {
    const result = routeParamsSchema.safeParse({ id: 'new' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('new');
    }
  });

  it('parses a valid UUID id', () => {
    const result = routeParamsSchema.safeParse({ id: VALID_UUID });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID);
    }
  });

  it('fails when id is missing', () => {
    expect(routeParamsSchema.safeParse({}).success).toBe(false);
  });

  it('fails when id is not new or a valid UUID', () => {
    expect(routeParamsSchema.safeParse({ id: '' }).success).toBe(false);
    expect(routeParamsSchema.safeParse({ id: 'abc-123' }).success).toBe(false);
  });
});
