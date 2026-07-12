import { describe, expect, it } from 'vitest';
import {
  repairBookingsListQuerySchema,
  repairPickupRequestSchema,
  updateRepairBookingSchema,
} from './repair-bookings';

describe('repairBookingsListQuerySchema', () => {
  it('applies default pagination', () => {
    expect(repairBookingsListQuerySchema.parse({})).toEqual({
      limit: 25,
      offset: 0,
    });
  });

  it('accepts a valid status filter and coerces pagination', () => {
    const parsed = repairBookingsListQuerySchema.parse({
      status: 'in_progress',
      limit: '10',
      offset: '20',
    });
    expect(parsed).toMatchObject({
      status: 'in_progress',
      limit: 10,
      offset: 20,
    });
  });

  it('rejects an unknown status', () => {
    expect(
      repairBookingsListQuerySchema.safeParse({ status: 'shipped' }).success
    ).toBe(false);
  });

  it('caps the limit at 100', () => {
    expect(
      repairBookingsListQuerySchema.safeParse({ limit: '101' }).success
    ).toBe(false);
  });
});

describe('updateRepairBookingSchema', () => {
  it('accepts a status change', () => {
    expect(updateRepairBookingSchema.parse({ status: 'confirmed' })).toEqual({
      status: 'confirmed',
    });
  });

  it('accepts a nullable estimated cost and notes', () => {
    expect(
      updateRepairBookingSchema.parse({
        estimated_cost: 25_000,
        admin_notes: '  diagnosed  ',
      })
    ).toEqual({ estimated_cost: 25_000, admin_notes: 'diagnosed' });
  });

  it('rejects an empty update', () => {
    expect(updateRepairBookingSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a negative estimated cost', () => {
    expect(
      updateRepairBookingSchema.safeParse({ estimated_cost: -1 }).success
    ).toBe(false);
  });
});

describe('repairPickupRequestSchema', () => {
  it('defaults to auto mode', () => {
    expect(repairPickupRequestSchema.parse({})).toEqual({ mode: 'auto' });
  });

  it('accepts manual mode', () => {
    expect(repairPickupRequestSchema.parse({ mode: 'manual' })).toEqual({
      mode: 'manual',
    });
  });

  it('rejects an unknown mode', () => {
    expect(repairPickupRequestSchema.safeParse({ mode: 'drone' }).success).toBe(
      false
    );
  });
});
