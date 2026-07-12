import { describe, expect, it } from 'vitest';
import { analyticsEventRequestSchema } from './analytics-event';

const MERCHANT_ID = '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235';

describe('analyticsEventRequestSchema', () => {
  it('accepts the bounded storefront event shape', () => {
    expect(
      analyticsEventRequestSchema.safeParse({
        event_type: 'add_to_cart',
        merchant_id: MERCHANT_ID,
        product_id: 'product-1',
        product_price: 100,
        quantity: 1,
      }).success
    ).toBe(true);
  });

  it('rejects caller-controlled routing fields', () => {
    expect(
      analyticsEventRequestSchema.safeParse({
        destinations: ['facebook'],
        event_type: 'purchase',
        merchant_id: MERCHANT_ID,
      }).success
    ).toBe(false);
  });

  it('rejects oversized batches', () => {
    const items = Array.from({ length: 201 }, (_, index) => ({
      id: `item-${index}`,
      quantity: 1,
    }));

    expect(
      analyticsEventRequestSchema.safeParse({
        event_type: 'begin_checkout',
        items,
        merchant_id: MERCHANT_ID,
      }).success
    ).toBe(false);
  });

  it('allows bounded primitive platform extras in custom data', () => {
    expect(
      analyticsEventRequestSchema.safeParse({
        custom_data: { campaign: 'summer', promoted: true, score: 10 },
        event_type: 'product_view',
        merchant_id: MERCHANT_ID,
      }).success
    ).toBe(true);
  });

  it('rejects unbounded or nested custom-data extras', () => {
    expect(
      analyticsEventRequestSchema.safeParse({
        custom_data: { campaign: 'x'.repeat(501) },
        event_type: 'product_view',
        merchant_id: MERCHANT_ID,
      }).success
    ).toBe(false);
    expect(
      analyticsEventRequestSchema.safeParse({
        custom_data: { campaign: { nested: true } },
        event_type: 'product_view',
        merchant_id: MERCHANT_ID,
      }).success
    ).toBe(false);
  });

  it('rejects malformed merchant and event identifiers at the boundary', () => {
    expect(
      analyticsEventRequestSchema.safeParse({
        event_type: 'not.valid',
        merchant_id: 'not-a-uuid',
      }).success
    ).toBe(false);
  });
});
