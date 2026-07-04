import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPendingPostHogWebVitals,
  drainPendingPostHogWebVitals,
  enqueuePostHogWebVital,
  MAX_PENDING_WEB_VITALS,
  type PostHogWebVitalsPayload,
} from './web-vitals-queue';

function buildPayload(
  overrides: Partial<PostHogWebVitalsPayload> = {}
): PostHogWebVitalsPayload {
  return {
    metric: 'LCP',
    value: 2400,
    rating: 'good',
    navigationType: 'navigate',
    pathname: '/dashboard',
    ...overrides,
  };
}

afterEach(() => {
  clearPendingPostHogWebVitals();
});

describe('web-vitals-queue', () => {
  it('buffers payloads and drains them oldest-first exactly once', () => {
    // Arrange
    const first = buildPayload({ metric: 'TTFB', value: 120 });
    const second = buildPayload({ metric: 'FCP', value: 900 });

    // Act
    enqueuePostHogWebVital(first);
    enqueuePostHogWebVital(second);
    const drained = drainPendingPostHogWebVitals();

    // Assert
    expect(drained).toEqual([first, second]);
    expect(drainPendingPostHogWebVitals()).toEqual([]);
  });

  it('drops the oldest payload once the cap is exceeded', () => {
    // Arrange
    const overflow = MAX_PENDING_WEB_VITALS + 2;

    // Act
    for (let index = 0; index < overflow; index += 1) {
      enqueuePostHogWebVital(buildPayload({ value: index }));
    }
    const drained = drainPendingPostHogWebVitals();

    // Assert
    expect(drained).toHaveLength(MAX_PENDING_WEB_VITALS);
    expect(drained[0]?.value).toBe(overflow - MAX_PENDING_WEB_VITALS);
    expect(drained.at(-1)?.value).toBe(overflow - 1);
  });

  it('clears buffered payloads without draining them', () => {
    // Arrange
    enqueuePostHogWebVital(buildPayload());

    // Act
    clearPendingPostHogWebVitals();

    // Assert
    expect(drainPendingPostHogWebVitals()).toEqual([]);
  });
});
