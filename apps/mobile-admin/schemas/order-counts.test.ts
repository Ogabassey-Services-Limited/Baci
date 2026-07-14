import { describe, expect, it } from 'vitest';
import { orderCountsSchema } from './order-counts';

const validCounts = {
  all: 8,
  paid: 4,
  pending: 1,
  processing: 1,
  shipped: 1,
  delivered: 1,
  cancelled: 1,
  returned: 1,
};

describe('orderCountsSchema', () => {
  it('accepts nonnegative integer counts', () => {
    expect(orderCountsSchema.parse(validCounts)).toEqual(validCounts);
  });

  it.each([
    ['missing fields', { ...validCounts, returned: undefined }],
    ['negative values', { ...validCounts, paid: -1 }],
    ['fractional values', { ...validCounts, shipped: 1.5 }],
    ['string values', { ...validCounts, delivered: '1' }],
    ['NaN values', { ...validCounts, cancelled: Number.NaN }],
    ['unknown fields', { ...validCounts, refunded: 1 }],
  ])('rejects %s', (_label, value) => {
    expect(orderCountsSchema.safeParse(value).success).toBe(false);
  });
});
