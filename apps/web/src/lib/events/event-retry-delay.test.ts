import { describe, expect, it } from 'vitest';
import { getEventRetryDelaySeconds } from './event-retry-delay';

describe('getEventRetryDelaySeconds', () => {
  it('uses bounded exponential delays with injected jitter', () => {
    expect(getEventRetryDelaySeconds(1, () => 0.5)).toBe(30);
    expect(getEventRetryDelaySeconds(4, () => 0.5)).toBe(1_800);
    expect(getEventRetryDelaySeconds(20, () => 0.5)).toBe(86_400);
  });

  it('caps jitter at its valid range', () => {
    expect(getEventRetryDelaySeconds(1, () => -10)).toBe(24);
    expect(getEventRetryDelaySeconds(1, () => 10)).toBe(36);
  });
});
