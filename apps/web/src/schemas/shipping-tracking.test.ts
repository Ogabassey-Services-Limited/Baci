import { describe, expect, it } from 'vitest';
import { trackingParamsSchema } from './shipping-tracking';

describe('trackingParamsSchema', () => {
  it('accepts and trims a tracking number', () => {
    const result = trackingParamsSchema.safeParse({
      trackingNumber: '  TRACK123  ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.trackingNumber).toBe('TRACK123');
    }
  });

  it('rejects an empty tracking number', () => {
    const result = trackingParamsSchema.safeParse({ trackingNumber: '   ' });

    expect(result.success).toBe(false);
  });
});
