import { describe, expect, it } from 'vitest';
import { getDeliveryEstimate } from './product-delivery-estimate';

describe('getDeliveryEstimate', () => {
  const FIXED_DATE = new Date('2024-01-10T12:00:00Z');

  it('returns a 1–2 day window for Lagos', () => {
    const result = getDeliveryEstimate('Lagos', FIXED_DATE);
    const plus1 = new Date(FIXED_DATE);
    plus1.setDate(FIXED_DATE.getDate() + 1);
    const plus2 = new Date(FIXED_DATE);
    plus2.setDate(FIXED_DATE.getDate() + 2);

    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(d);

    expect(result).toBe(`${fmt(plus1)} - ${fmt(plus2)}`);
  });

  it('returns a 3–5 day window for Outside Lagos', () => {
    const result = getDeliveryEstimate('Outside Lagos', FIXED_DATE);
    const plus3 = new Date(FIXED_DATE);
    plus3.setDate(FIXED_DATE.getDate() + 3);
    const plus5 = new Date(FIXED_DATE);
    plus5.setDate(FIXED_DATE.getDate() + 5);

    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(d);

    expect(result).toBe(`${fmt(plus3)} - ${fmt(plus5)}`);
  });
});
