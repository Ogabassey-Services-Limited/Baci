export function toAnalyticsDomainEventName(eventType: string): string {
  return eventType === 'purchase'
    ? 'analytics.purchase.completed.v1'
    : `analytics.${eventType}.v1`;
}
