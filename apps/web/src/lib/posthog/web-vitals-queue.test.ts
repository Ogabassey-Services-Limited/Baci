import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingPostHogWebVitals,
  drainPendingPostHogWebVitals,
  enqueuePostHogWebVital,
  MAX_PENDING_WEB_VITALS,
  type PostHogWebVitalsPayload,
} from './web-vitals-queue';

const ORIGIN_HREF = 'https://ogabassey.com/blog-guides/best-phones';

function buildPayload(
  overrides: Partial<PostHogWebVitalsPayload> = {}
): PostHogWebVitalsPayload {
  return {
    metric: 'LCP',
    value: 2400,
    rating: 'good',
    navigationType: 'navigate',
    pathname: '/blog-guides/best-phones',
    ...overrides,
  };
}

function stampOrigin(
  payload: PostHogWebVitalsPayload,
  href: string
): PostHogWebVitalsPayload {
  return { ...payload, $current_url: href, $pathname: payload.pathname };
}

function stubLocationHref(href: string): void {
  vi.stubGlobal('location', { href });
}

beforeEach(() => {
  stubLocationHref(ORIGIN_HREF);
});

afterEach(() => {
  clearPendingPostHogWebVitals();
  vi.unstubAllGlobals();
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

    // Assert: order preserved; each payload pinned to its origin URL.
    expect(drained).toEqual([
      stampOrigin(first, ORIGIN_HREF),
      stampOrigin(second, ORIGIN_HREF),
    ]);
    expect(drainPendingPostHogWebVitals()).toEqual([]);
  });

  it('pins the origin $current_url/$pathname so a later navigation cannot rewrite it', () => {
    // Arrange: a metric measured on page A, buffered before the idle boot.
    const pageA = buildPayload({
      metric: 'TTFB',
      value: 90,
      pathname: '/blog-guides/best-phones',
    });
    stubLocationHref(ORIGIN_HREF);
    enqueuePostHogWebVital(pageA);

    // Act: the client navigates to page B before the queue flushes.
    stubLocationHref('https://ogabassey.com/checkout');
    const [flushed] = drainPendingPostHogWebVitals();

    // Assert: the flushed event still carries page A's identity, not page B's.
    expect(flushed?.$current_url).toBe(ORIGIN_HREF);
    expect(flushed?.$pathname).toBe('/blog-guides/best-phones');
  });

  it('never overwrites an already-pinned origin when re-enqueued', () => {
    // Arrange: a payload already stamped on page A.
    const pinned = stampOrigin(buildPayload({ metric: 'FCP' }), ORIGIN_HREF);

    // Act: re-enqueued after navigating away.
    stubLocationHref('https://ogabassey.com/checkout');
    enqueuePostHogWebVital(pinned);
    const [flushed] = drainPendingPostHogWebVitals();

    // Assert: the original origin survives the re-enqueue.
    expect(flushed?.$current_url).toBe(ORIGIN_HREF);
  });

  it('buffers without a $current_url when location is unavailable', () => {
    // Arrange: no browser location (SSR-ish / pre-hydration edge).
    vi.stubGlobal('location', undefined);
    const payload = buildPayload();

    // Act
    enqueuePostHogWebVital(payload);
    const [flushed] = drainPendingPostHogWebVitals();

    // Assert: payload buffered untouched rather than throwing.
    expect(flushed).toEqual(payload);
    expect(flushed?.$current_url).toBeUndefined();
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
