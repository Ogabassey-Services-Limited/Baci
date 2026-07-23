import { describe, expect, it } from 'vitest';
import { toClientAnalyticsDomainEventName } from './client-analytics-domain-event-name';

describe('toClientAnalyticsDomainEventName', () => {
  it('keeps a verified client event on its canonical route', () => {
    expect(
      toClientAnalyticsDomainEventName('add_to_cart', 'tenant_verified_client')
    ).toBe('analytics.add_to_cart.v1');
  });

  it('downgrades anonymous and server-only client claims', () => {
    expect(
      toClientAnalyticsDomainEventName('add_to_cart', 'anonymous_client')
    ).toBe('analytics.client.observed.v1');
    expect(
      toClientAnalyticsDomainEventName('place_order', 'tenant_verified_client')
    ).toBe('analytics.client.observed.v1');
  });

  it('never treats a client purchase claim as paid-order confirmation', () => {
    expect(
      toClientAnalyticsDomainEventName('purchase', 'tenant_verified_client')
    ).toBe('analytics.purchase.observed.v1');
  });
});
