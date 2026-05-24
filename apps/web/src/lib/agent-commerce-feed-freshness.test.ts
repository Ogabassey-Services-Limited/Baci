import { describe, expect, it } from 'vitest';
import { AGENT_COMMERCE_FEED_FRESHNESS } from './agent-commerce-feed-freshness';

describe('AGENT_COMMERCE_FEED_FRESHNESS', () => {
  const now = new Date('2026-05-22T12:00:00.000Z');

  it('counts stale, missing, and invalid product timestamps', () => {
    expect(
      AGENT_COMMERCE_FEED_FRESHNESS.countStaleProducts({
        now,
        products: [
          { updated_at: '2026-05-22T10:00:00.000Z' },
          { updated_at: '2026-04-01T10:00:00.000Z' },
          { updated_at: null },
          { updated_at: 'not-a-date' },
        ],
      })
    ).toBe(3);
  });

  it('counts missing and invalid product timestamps', () => {
    expect(
      AGENT_COMMERCE_FEED_FRESHNESS.countProductsMissingTimestamps([
        { updated_at: '2026-05-22T10:00:00.000Z' },
        { updated_at: null },
        { updated_at: undefined },
        { updated_at: 'not-a-date' },
      ])
    ).toBe(3);
  });

  it('passes current coverage at or above the configured threshold', () => {
    expect(
      AGENT_COMMERCE_FEED_FRESHNESS.hasCurrentProductCoverage({
        staleProducts: 2,
        totalProducts: 100,
      })
    ).toBe(true);
  });

  it('fails current coverage below the configured threshold', () => {
    expect(
      AGENT_COMMERCE_FEED_FRESHNESS.hasCurrentProductCoverage({
        staleProducts: 3,
        totalProducts: 100,
      })
    ).toBe(false);
  });
});
