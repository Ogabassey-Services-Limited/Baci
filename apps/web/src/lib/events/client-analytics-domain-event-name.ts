import type { DomainEventV1 } from '@baci/shared/contracts';
import { toAnalyticsDomainEventName } from './analytics-domain-event-name';

const CLIENT_ANALYTICS_OBSERVATION_ONLY = new Set(['place_order', 'purchase']);

export function toClientAnalyticsDomainEventName(
  eventType: string,
  trustLevel: DomainEventV1['trust_level']
): string {
  if (trustLevel === 'anonymous_client') return 'analytics.client.observed.v1';
  if (eventType === 'purchase') return 'analytics.purchase.observed.v1';
  if (CLIENT_ANALYTICS_OBSERVATION_ONLY.has(eventType)) {
    return 'analytics.client.observed.v1';
  }
  return toAnalyticsDomainEventName(eventType);
}
