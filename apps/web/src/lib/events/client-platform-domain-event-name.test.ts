import { describe, expect, it } from 'vitest';
import { toClientPlatformDomainEventName } from './client-platform-domain-event-name';

describe('toClientPlatformDomainEventName', () => {
  it('downgrades anonymous server-only platform claims', () => {
    expect(
      toClientPlatformDomainEventName('platform_purchase', 'anonymous_client')
    ).toBe('platform.client.observed.v1');
  });

  it('downgrades server-only client platform claims', () => {
    expect(
      toClientPlatformDomainEventName(
        'platform_purchase',
        'tenant_verified_client'
      )
    ).toBe('platform.client.observed.v1');
  });

  it('allows low-risk public platform funnel events without merchant trust', () => {
    expect(
      toClientPlatformDomainEventName('landing_page_view', 'anonymous_client')
    ).toBe('platform.landing_page_view.v1');
  });
});
