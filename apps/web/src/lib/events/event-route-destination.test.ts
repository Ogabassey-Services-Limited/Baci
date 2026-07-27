import { describe, expect, it } from 'vitest';
import type { EventRouteDestination } from './event-route-destination';

describe('EventRouteDestination', () => {
  it('includes the single canonical cache-transition destination', () => {
    const destination: EventRouteDestination = 'storefront_cache_transition';
    expect(destination).toBe('storefront_cache_transition');
  });
});
