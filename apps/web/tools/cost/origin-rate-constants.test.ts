import { describe, expect, it } from 'vitest';
import { DEFAULT_ORIGIN_RATE_THRESHOLD } from './origin-rate-constants';

describe('origin-rate-constants', () => {
  it('keeps the reviewed production threshold bounded and positive', () => {
    expect(DEFAULT_ORIGIN_RATE_THRESHOLD).toBeGreaterThan(0);
    expect(DEFAULT_ORIGIN_RATE_THRESHOLD).toBeLessThan(1);
  });
});
