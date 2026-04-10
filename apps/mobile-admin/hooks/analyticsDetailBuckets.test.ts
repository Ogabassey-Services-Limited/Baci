import { describe, expect, it } from 'vitest';
import { getBucketIndex } from './analyticsDetailBuckets';

describe('getBucketIndex', () => {
  it('assigns hourly buckets using the provided timezone instead of UTC', () => {
    const date = new Date('2026-04-10T23:30:00.000Z');

    expect(getBucketIndex(date, 'hourly', 'Africa/Lagos')).toBe(0);
    expect(getBucketIndex(date, 'hourly', 'America/Los_Angeles')).toBe(16);
  });

  it('assigns weekday buckets using the provided timezone instead of UTC', () => {
    const date = new Date('2026-04-10T23:30:00.000Z');

    expect(getBucketIndex(date, 'weekday', 'UTC')).toBe(5);
    expect(getBucketIndex(date, 'weekday', 'Africa/Lagos')).toBe(6);
  });

  it('assigns month buckets using the provided timezone instead of UTC', () => {
    const date = new Date('2026-12-31T23:30:00.000Z');

    expect(getBucketIndex(date, 'month', 'UTC')).toBe(11);
    expect(getBucketIndex(date, 'month', 'Pacific/Kiritimati')).toBe(0);
  });

  it('returns -1 when the provided timezone is invalid', () => {
    const date = new Date('2026-04-10T23:30:00.000Z');

    expect(getBucketIndex(date, 'hourly', 'Invalid/Timezone')).toBe(-1);
  });
});
