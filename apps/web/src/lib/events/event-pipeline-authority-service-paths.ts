import { eventPipelineAdsServicePaths } from '@/lib/events/event-pipeline-ads-service-paths';

export const eventPipelineAuthorityServicePaths = [
  ...eventPipelineAdsServicePaths,
  [
    'apps/web/src/app/api/cron/provision-wallet-funding-recovery-hmac/route.ts',
    'apps/web/src/lib/wallet/server-funding-recovery-hmac-client.ts',
  ],
  [
    'apps/web/src/lib/shipping/shipping-quote-booking-economics.ts',
    'apps/web/src/lib/shipping/server-shipping-quote-booking-economics-client.ts',
  ],
] as const;
