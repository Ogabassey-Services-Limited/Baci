import { describe, expect, it } from 'vitest';
import { toPlatformDomainEventName } from './platform-domain-event-name';

describe('toPlatformDomainEventName', () => {
  it('versions platform names', () => {
    expect(toPlatformDomainEventName('pricing_page_view')).toBe(
      'platform.pricing_page_view.v1'
    );
  });

  it('versions an unknown platform event name without reclassifying it', () => {
    expect(toPlatformDomainEventName('unregistered_event')).toBe(
      'platform.unregistered_event.v1'
    );
  });
});
