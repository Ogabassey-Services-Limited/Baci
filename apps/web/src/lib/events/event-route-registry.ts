import type { DomainEventV1 } from '@baci/shared/contracts';

export type EventDestination = 'facebook' | 'ga4' | 'snapchat' | 'tiktok';
type EventTrustLevel = DomainEventV1['trust_level'];
type EventProducer = DomainEventV1['producer'];

type RouteDefinition = {
  allowedProducers: readonly EventProducer[];
  allowedTrust: readonly EventTrustLevel[];
  destinations: readonly EventDestination[];
};

const VERIFIED_CLIENT_TRUST: readonly EventTrustLevel[] = [
  'authenticated_client',
  'tenant_verified_client',
];
const PUBLIC_CLIENT_TRUST: readonly EventTrustLevel[] = [
  'anonymous_client',
  ...VERIFIED_CLIENT_TRUST,
];
const SERVER_TRUST: readonly EventTrustLevel[] = ['server', 'database'];
const CLIENT_PRODUCERS: readonly EventProducer[] = ['web', 'mobile'];
const SERVER_PRODUCERS: readonly EventProducer[] = ['worker', 'database'];
const CLIENT_ANALYTICS_OBSERVATION_ONLY = new Set(['place_order', 'purchase']);
const CLIENT_PLATFORM_OBSERVATION_ONLY = new Set([
  'merchant_first_sale',
  'merchant_signup_completed',
  'merchant_store_published',
  'platform_purchase',
]);
const PUBLIC_PLATFORM_EVENTS = new Set([
  'landing_page_view',
  'merchant_signup_started',
  'pricing_page_view',
]);

const EVENT_ROUTES: Record<string, RouteDefinition> = {
  'analytics.add_payment_info.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: VERIFIED_CLIENT_TRUST,
    destinations: ['facebook', 'tiktok', 'snapchat'],
  },
  'analytics.add_to_cart.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: VERIFIED_CLIENT_TRUST,
    destinations: ['facebook', 'tiktok', 'snapchat'],
  },
  'analytics.add_to_wishlist.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: VERIFIED_CLIENT_TRUST,
    destinations: ['facebook', 'tiktok', 'snapchat'],
  },
  'analytics.begin_checkout.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: VERIFIED_CLIENT_TRUST,
    destinations: ['facebook', 'tiktok', 'snapchat'],
  },
  'analytics.customer_registered.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: VERIFIED_CLIENT_TRUST,
    destinations: ['facebook', 'tiktok', 'snapchat'],
  },
  'analytics.place_order.v1': {
    allowedProducers: SERVER_PRODUCERS,
    allowedTrust: SERVER_TRUST,
    destinations: ['tiktok'],
  },
  'analytics.product_view.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: VERIFIED_CLIENT_TRUST,
    destinations: ['facebook', 'tiktok', 'snapchat'],
  },
  'analytics.purchase.completed.v1': {
    allowedProducers: SERVER_PRODUCERS,
    allowedTrust: SERVER_TRUST,
    destinations: ['facebook', 'tiktok', 'ga4', 'snapchat'],
  },
  'analytics.search.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: VERIFIED_CLIENT_TRUST,
    destinations: ['facebook', 'tiktok', 'snapchat'],
  },
  'platform.landing_page_view.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: PUBLIC_CLIENT_TRUST,
    destinations: ['facebook', 'ga4'],
  },
  'platform.merchant_first_sale.v1': {
    allowedProducers: SERVER_PRODUCERS,
    allowedTrust: SERVER_TRUST,
    destinations: ['facebook', 'ga4'],
  },
  'platform.merchant_signup_completed.v1': {
    allowedProducers: SERVER_PRODUCERS,
    allowedTrust: SERVER_TRUST,
    destinations: ['facebook', 'ga4'],
  },
  'platform.merchant_signup_started.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: PUBLIC_CLIENT_TRUST,
    destinations: ['facebook', 'ga4'],
  },
  'platform.merchant_store_published.v1': {
    allowedProducers: SERVER_PRODUCERS,
    allowedTrust: SERVER_TRUST,
    destinations: ['facebook', 'ga4'],
  },
  'platform.platform_checkout.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: VERIFIED_CLIENT_TRUST,
    destinations: ['ga4'],
  },
  'platform.platform_purchase.v1': {
    allowedProducers: SERVER_PRODUCERS,
    allowedTrust: SERVER_TRUST,
    destinations: ['facebook', 'ga4'],
  },
  'platform.pricing_page_view.v1': {
    allowedProducers: CLIENT_PRODUCERS,
    allowedTrust: PUBLIC_CLIENT_TRUST,
    destinations: ['ga4'],
  },
};

const CLIENT_OBSERVATION_ONLY_EVENTS = new Set([
  'analytics.client.observed.v1',
  'analytics.page_view.v1',
  'analytics.purchase.observed.v1',
  'analytics.remove_from_cart.v1',
  'analytics.share.v1',
  'platform.client.observed.v1',
]);
const DATABASE_OBSERVATION_ONLY_EVENTS = new Set([
  'catalog.product.created.v1',
  'catalog.product.deleted.v1',
  'catalog.product.updated.v1',
  'commerce.order.cancelled.v1',
  'commerce.order.paid.v1',
  'commerce.order.status_changed.v1',
  'payments.transaction.status_changed.v1',
]);

export type EventRouteResolution =
  | { kind: 'dead_letter'; code: string }
  | { kind: 'no_route'; destinations: [] }
  | { kind: 'route'; destinations: EventDestination[] };

export function resolveEventRoute(event: DomainEventV1): EventRouteResolution {
  if (CLIENT_OBSERVATION_ONLY_EVENTS.has(event.event_name)) {
    if (
      !CLIENT_PRODUCERS.includes(event.producer) ||
      !PUBLIC_CLIENT_TRUST.includes(event.trust_level)
    ) {
      return {
        code: 'producer_not_authorized_for_event',
        kind: 'dead_letter',
      };
    }
    return { destinations: [], kind: 'no_route' };
  }
  if (DATABASE_OBSERVATION_ONLY_EVENTS.has(event.event_name)) {
    if (event.producer !== 'database' || event.trust_level !== 'database') {
      return {
        code: 'producer_not_authorized_for_event',
        kind: 'dead_letter',
      };
    }
    return { destinations: [], kind: 'no_route' };
  }

  const definition = EVENT_ROUTES[event.event_name];
  if (!definition) {
    return { code: 'unknown_event_name', kind: 'dead_letter' };
  }
  if (
    !definition.allowedProducers.includes(event.producer) ||
    !definition.allowedTrust.includes(event.trust_level)
  ) {
    return {
      code: 'producer_not_authorized_for_event',
      kind: 'dead_letter',
    };
  }
  const eventData =
    event.data.event_data && typeof event.data.event_data === 'object'
      ? (event.data.event_data as Record<string, unknown>)
      : undefined;
  const rawTargets = eventData?.targets;
  const requestedTargets = Array.isArray(rawTargets)
    ? rawTargets
        .filter((target): target is string => typeof target === 'string')
        .map((target) => (target === 'google' ? 'ga4' : target))
    : undefined;
  const destinations = requestedTargets
    ? definition.destinations.filter((destination) =>
        requestedTargets.includes(destination)
      )
    : [...definition.destinations];
  return destinations.length > 0
    ? { destinations, kind: 'route' }
    : { destinations: [], kind: 'no_route' };
}

export function toAnalyticsDomainEventName(eventType: string): string {
  return eventType === 'purchase'
    ? 'analytics.purchase.completed.v1'
    : `analytics.${eventType}.v1`;
}

export function toPlatformDomainEventName(eventType: string): string {
  return `platform.${eventType}.v1`;
}

export function toClientAnalyticsDomainEventName(
  eventType: string,
  trustLevel: EventTrustLevel
): string {
  if (trustLevel === 'anonymous_client') return 'analytics.client.observed.v1';
  if (eventType === 'purchase') return 'analytics.purchase.observed.v1';
  if (CLIENT_ANALYTICS_OBSERVATION_ONLY.has(eventType)) {
    return 'analytics.client.observed.v1';
  }
  return toAnalyticsDomainEventName(eventType);
}

export function toClientPlatformDomainEventName(
  eventType: string,
  trustLevel: EventTrustLevel
): string {
  if (CLIENT_PLATFORM_OBSERVATION_ONLY.has(eventType)) {
    return 'platform.client.observed.v1';
  }
  if (
    trustLevel === 'anonymous_client' &&
    !PUBLIC_PLATFORM_EVENTS.has(eventType)
  ) {
    return 'platform.client.observed.v1';
  }
  return toPlatformDomainEventName(eventType);
}
