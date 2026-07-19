import type { DomainEventV1 } from '@baci/shared/contracts';
import { describe, expect, it } from 'vitest';
import {
  resolveEventRoute,
  toAnalyticsDomainEventName,
  toClientAnalyticsDomainEventName,
  toClientPlatformDomainEventName,
  toPlatformDomainEventName,
} from './event-route-registry';

function event(overrides: Partial<DomainEventV1> = {}): DomainEventV1 {
  return {
    data: {},
    domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
    event_name: 'analytics.begin_checkout.v1',
    idempotency_key: 'event-1',
    metadata: { environment: 'test' },
    occurred_at: '2026-07-12T12:00:00.000Z',
    producer: 'web',
    schema_version: 1,
    source: {},
    subject: { id: 'subject-1', type: 'analytics_event' },
    trust_level: 'tenant_verified_client',
    ...overrides,
  };
}

describe('event route registry facade', () => {
  it('preserves public route resolution and naming exports', () => {
    const eventName = toClientPlatformDomainEventName(
      'landing_page_view',
      'anonymous_client'
    );

    expect(resolveEventRoute(event())).toEqual({
      destinations: ['facebook', 'tiktok', 'snapchat'],
      kind: 'route',
    });
    expect(toAnalyticsDomainEventName('purchase')).toBe(
      'analytics.purchase.completed.v1'
    );
    expect(toPlatformDomainEventName('pricing_page_view')).toBe(
      'platform.pricing_page_view.v1'
    );
    expect(
      toClientAnalyticsDomainEventName('purchase', 'tenant_verified_client')
    ).toBe('analytics.purchase.observed.v1');
    expect(eventName).toBe('platform.landing_page_view.v1');
    expect(
      resolveEventRoute(
        event({ event_name: eventName, trust_level: 'anonymous_client' })
      )
    ).toEqual({ destinations: ['facebook', 'ga4'], kind: 'route' });
  });
});
