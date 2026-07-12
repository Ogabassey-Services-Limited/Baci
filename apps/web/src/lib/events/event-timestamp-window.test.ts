import { describe, expect, it } from 'vitest';
import { isEventTimestampWithinWindow } from './event-timestamp-window';

const NOW = Date.parse('2026-07-12T12:00:00.000Z');

describe('isEventTimestampWithinWindow', () => {
  it('accepts current ISO and epoch-second events', () => {
    expect(isEventTimestampWithinWindow('2026-07-12T11:59:00.000Z', NOW)).toBe(
      true
    );
    expect(isEventTimestampWithinWindow(NOW / 1_000, NOW)).toBe(true);
  });

  it('rejects stale and future-dated events', () => {
    expect(isEventTimestampWithinWindow('2026-07-10T12:00:00.000Z', NOW)).toBe(
      false
    );
    expect(isEventTimestampWithinWindow('2026-07-12T12:06:00.000Z', NOW)).toBe(
      false
    );
  });
});
