import { describe, expect, it } from 'vitest';
import {
  insuranceOrderIdParamSchema,
  orderPolicyRouteParamsSchema,
} from './insurance-route-params';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('orderPolicyRouteParamsSchema', () => {
  it('accepts a uuid orderId and rejects a non-uuid', () => {
    expect(
      orderPolicyRouteParamsSchema.safeParse({ orderId: VALID_UUID }).success
    ).toBe(true);
    expect(
      orderPolicyRouteParamsSchema.safeParse({ orderId: 'order-123' }).success
    ).toBe(false);
  });
});

describe('insuranceOrderIdParamSchema', () => {
  it('accepts a uuid and rejects a blank/invalid value', () => {
    expect(insuranceOrderIdParamSchema.safeParse(VALID_UUID).success).toBe(
      true
    );
    expect(insuranceOrderIdParamSchema.safeParse('').success).toBe(false);
  });
});
