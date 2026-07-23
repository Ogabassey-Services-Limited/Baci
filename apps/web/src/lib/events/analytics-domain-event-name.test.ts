import { describe, expect, it } from 'vitest';
import { toAnalyticsDomainEventName } from './analytics-domain-event-name';

describe('toAnalyticsDomainEventName', () => {
  it('uses the trusted purchase event name', () => {
    expect(toAnalyticsDomainEventName('purchase')).toBe(
      'analytics.purchase.completed.v1'
    );
  });

  it('versions other analytics names', () => {
    expect(toAnalyticsDomainEventName('add_to_cart')).toBe(
      'analytics.add_to_cart.v1'
    );
  });
});
