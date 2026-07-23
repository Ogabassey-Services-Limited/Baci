import type { DomainEventV1 } from '@baci/shared/contracts';
import { toPlatformDomainEventName } from './platform-domain-event-name';

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

export function toClientPlatformDomainEventName(
  eventType: string,
  trustLevel: DomainEventV1['trust_level']
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
