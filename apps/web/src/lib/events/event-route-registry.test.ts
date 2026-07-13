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

describe('resolveEventRoute', () => {
  it('routes client checkout events independently', () => {
    expect(resolveEventRoute(event())).toEqual({
      destinations: ['facebook', 'tiktok', 'snapchat'],
      kind: 'route',
    });
  });

  it('honours explicit delivery targets in durable event data', () => {
    expect(
      resolveEventRoute(
        event({ data: { event_data: { targets: ['facebook', 'google'] } } })
      )
    ).toEqual({ destinations: ['facebook'], kind: 'route' });
  });

  it('rejects anonymous purchase claims', () => {
    expect(
      resolveEventRoute(
        event({
          event_name: 'analytics.purchase.completed.v1',
          trust_level: 'anonymous_client',
        })
      )
    ).toEqual({
      code: 'producer_not_authorized_for_event',
      kind: 'dead_letter',
    });
  });

  it('routes trusted paid-order events to all purchase destinations', () => {
    expect(
      resolveEventRoute(
        event({
          event_name: 'analytics.purchase.completed.v1',
          producer: 'worker',
          trust_level: 'server',
        })
      )
    ).toEqual({
      destinations: ['facebook', 'tiktok', 'ga4', 'snapchat'],
      kind: 'route',
    });
  });

  it('rejects a trusted label from the wrong producer boundary', () => {
    expect(
      resolveEventRoute(
        event({
          event_name: 'analytics.purchase.completed.v1',
          producer: 'web',
          trust_level: 'server',
        })
      )
    ).toEqual({
      code: 'producer_not_authorized_for_event',
      kind: 'dead_letter',
    });
  });

  it('rejects spoofed CDC names from non-database producers', () => {
    expect(
      resolveEventRoute(
        event({
          event_name: 'commerce.order.paid.v1',
          producer: 'web',
          trust_level: 'tenant_verified_client',
        })
      )
    ).toEqual({
      code: 'producer_not_authorized_for_event',
      kind: 'dead_letter',
    });
  });

  it('archives approved CDC events without a destination', () => {
    expect(
      resolveEventRoute(
        event({
          event_name: 'catalog.product.updated.v1',
          producer: 'database',
          trust_level: 'database',
        })
      )
    ).toEqual({ destinations: [], kind: 'no_route' });
  });

  it('dead-letters unknown names', () => {
    expect(
      resolveEventRoute(event({ event_name: 'unknown.event.created.v1' }))
    ).toEqual({ code: 'unknown_event_name', kind: 'dead_letter' });
  });
});

describe('domain event naming', () => {
  it('uses the trusted purchase event name', () => {
    expect(toAnalyticsDomainEventName('purchase')).toBe(
      'analytics.purchase.completed.v1'
    );
  });

  it('versions platform names', () => {
    expect(toPlatformDomainEventName('pricing_page_view')).toBe(
      'platform.pricing_page_view.v1'
    );
  });

  it('downgrades unverified client events to observation-only names', () => {
    expect(
      toClientAnalyticsDomainEventName('add_to_cart', 'anonymous_client')
    ).toBe('analytics.client.observed.v1');
    expect(
      toClientPlatformDomainEventName('platform_purchase', 'anonymous_client')
    ).toBe('platform.client.observed.v1');
  });

  it('allows low-risk public platform funnel events without merchant trust', () => {
    const eventName = toClientPlatformDomainEventName(
      'landing_page_view',
      'anonymous_client'
    );

    expect(eventName).toBe('platform.landing_page_view.v1');
    expect(
      resolveEventRoute(
        event({
          event_name: eventName,
          trust_level: 'anonymous_client',
        })
      )
    ).toEqual({ destinations: ['facebook', 'ga4'], kind: 'route' });
  });

  it('never treats a client purchase claim as paid-order confirmation', () => {
    expect(
      toClientAnalyticsDomainEventName('purchase', 'tenant_verified_client')
    ).toBe('analytics.purchase.observed.v1');
  });

  it('records other server-only client claims as observation telemetry', () => {
    expect(
      toClientAnalyticsDomainEventName('place_order', 'tenant_verified_client')
    ).toBe('analytics.client.observed.v1');
    expect(
      toClientPlatformDomainEventName(
        'platform_purchase',
        'tenant_verified_client'
      )
    ).toBe('platform.client.observed.v1');
  });
});
