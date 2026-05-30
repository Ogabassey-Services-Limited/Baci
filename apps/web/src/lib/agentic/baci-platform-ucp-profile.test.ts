import { describe, expect, it } from 'vitest';
import { buildBaciPlatformUcpProfile } from '@/lib/agentic/baci-platform-ucp-profile';

describe('buildBaciPlatformUcpProfile', () => {
  it('builds a root-domain platform profile', () => {
    expect(buildBaciPlatformUcpProfile('https://usebaci.com')).toMatchObject({
      platform: {
        name: 'Baci',
        type: 'merchant_platform',
      },
      ucp: {
        version: '2026-04-08',
        services: {},
        capabilities: {
          'com.usebaci.merchant_platform': [
            expect.objectContaining({
              config: {
                storefront_profile_path: '/.well-known/ucp',
              },
            }),
          ],
        },
        payment_handlers: {},
      },
      links: {
        merchant_onboarding: 'https://usebaci.com/onboarding',
        ogabassey_demo: 'https://ogabassey.com/.well-known/ucp',
      },
    });
  });

  it('rejects invalid base URLs', () => {
    expect(() => buildBaciPlatformUcpProfile('not-a-url')).toThrow();
  });
});
