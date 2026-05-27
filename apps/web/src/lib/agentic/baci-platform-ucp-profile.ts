import { UCP_PROFILE_VERSION } from '@/lib/agentic/ucp-profile-constants';

const BACI_PLATFORM_CAPABILITY = 'com.usebaci.merchant_platform';
const BACI_PLATFORM_PROFILE_VERSION = '2026-05-26';

export function buildBaciPlatformUcpProfile(baseUrl: string) {
  return {
    platform: {
      name: 'Baci',
      type: 'merchant_platform',
    },
    ucp: {
      version: UCP_PROFILE_VERSION,
      services: {},
      capabilities: {
        [BACI_PLATFORM_CAPABILITY]: [
          {
            version: BACI_PLATFORM_PROFILE_VERSION,
            config: {
              storefront_profile_path: '/.well-known/ucp',
            },
          },
        ],
      },
      payment_handlers: {},
    },
    links: {
      merchant_onboarding: new URL('/onboarding', baseUrl).toString(),
      ogabassey_demo: 'https://ogabassey.com/.well-known/ucp',
    },
  };
}
