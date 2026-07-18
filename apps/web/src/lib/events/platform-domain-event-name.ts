export function toPlatformDomainEventName(eventType: string): string {
  return `platform.${eventType}.v1`;
}
