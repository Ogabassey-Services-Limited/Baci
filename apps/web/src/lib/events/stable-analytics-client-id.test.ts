import { describe, expect, it } from 'vitest';
import { createStableAnalyticsClientId } from './stable-analytics-client-id';

describe('createStableAnalyticsClientId', () => {
  it('is stable across retries and differs across events', () => {
    expect(createStableAnalyticsClientId('event-1')).toBe(
      createStableAnalyticsClientId('event-1')
    );
    expect(createStableAnalyticsClientId('event-1')).not.toBe(
      createStableAnalyticsClientId('event-2')
    );
    expect(createStableAnalyticsClientId('event-1')).toMatch(/^\d+\.\d+$/);
  });
});
