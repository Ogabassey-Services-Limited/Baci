import { describe, expect, it } from 'vitest';
import { normalizeEventType } from './normalize-ad-platform-event-type';

describe('ad platform event normalization', () => {
  it('normalizes supported mobile names and rejects unknown conversions', () => {
    expect(normalizeEventType('START_CHECKOUT')).toBe('begin_checkout');
    expect(normalizeEventType('purchase')).toBe('purchase');
    expect(normalizeEventType('PAGE_VIEW')).toBeUndefined();
  });
});
