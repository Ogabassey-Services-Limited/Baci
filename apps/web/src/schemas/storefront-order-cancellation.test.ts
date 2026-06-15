import { describe, expect, it } from 'vitest';
import {
  MAX_CANCELLATION_REASON_LENGTH,
  storefrontOrderCancellationSchema,
} from '@/schemas/storefront-order-cancellation';

describe('storefrontOrderCancellationSchema', () => {
  it('accepts an omitted reason (cancellation is skippable)', () => {
    const result = storefrontOrderCancellationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBeUndefined();
    }
  });

  it('accepts a preset reason', () => {
    expect(
      storefrontOrderCancellationSchema.safeParse({
        reason: 'Changed my mind',
      }).success
    ).toBe(true);
  });

  it('accepts free text (the "Other" escape hatch)', () => {
    expect(
      storefrontOrderCancellationSchema.safeParse({
        reason: 'Bought the wrong size by accident',
      }).success
    ).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = storefrontOrderCancellationSchema.safeParse({
      reason: '  Ordered by mistake  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe('Ordered by mistake');
    }
  });

  it('rejects an empty or whitespace-only reason', () => {
    expect(
      storefrontOrderCancellationSchema.safeParse({ reason: '' }).success
    ).toBe(false);
    expect(
      storefrontOrderCancellationSchema.safeParse({ reason: '   ' }).success
    ).toBe(false);
  });

  it('rejects a reason longer than the max length', () => {
    expect(
      storefrontOrderCancellationSchema.safeParse({
        reason: 'x'.repeat(MAX_CANCELLATION_REASON_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it('rejects a non-string reason', () => {
    expect(
      storefrontOrderCancellationSchema.safeParse({ reason: 123 }).success
    ).toBe(false);
  });
});
