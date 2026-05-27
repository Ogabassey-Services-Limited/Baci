import { describe, expect, it } from 'vitest';
import { ucpCartRouteParamsSchema } from './ucp-cart-route-params';

describe('ucpCartRouteParamsSchema', () => {
  it('accepts non-empty cart ids', () => {
    const result = ucpCartRouteParamsSchema.safeParse({ id: 'cart_123' });

    expect(result.success).toBe(true);
  });

  it('rejects blank cart ids', () => {
    const result = ucpCartRouteParamsSchema.safeParse({ id: '   ' });

    expect(result.success).toBe(false);
  });
});
