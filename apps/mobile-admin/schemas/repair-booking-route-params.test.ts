import { describe, expect, it } from 'vitest';
import { repairBookingRouteParamsSchema } from './repair-booking-route-params';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('repairBookingRouteParamsSchema', () => {
  it('parses a valid UUID id', () => {
    const result = repairBookingRouteParamsSchema.safeParse({
      id: VALID_UUID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID);
    }
  });

  it('fails when id is missing', () => {
    expect(repairBookingRouteParamsSchema.safeParse({}).success).toBe(false);
  });

  it('fails when id is not a valid UUID', () => {
    expect(
      repairBookingRouteParamsSchema.safeParse({ id: '' }).success
    ).toBe(false);
    expect(
      repairBookingRouteParamsSchema.safeParse({ id: 'ticket-123' }).success
    ).toBe(false);
  });
});
