import { describe, expect, it } from 'vitest';
import { eventPipelineAdsServicePaths } from './event-pipeline-ads-service-paths';
import { eventPipelineAuthorityServicePaths } from './event-pipeline-authority-service-paths';

describe('eventPipelineAuthorityServicePaths', () => {
  it('extends ads service paths with wallet HMAC and booking-economics edges', () => {
    expect(eventPipelineAuthorityServicePaths).toEqual([
      ...eventPipelineAdsServicePaths,
      [
        'apps/web/src/app/api/cron/provision-wallet-funding-recovery-hmac/route.ts',
        'apps/web/src/lib/wallet/server-funding-recovery-hmac-client.ts',
      ],
      [
        'apps/web/src/lib/shipping/shipping-quote-booking-economics.ts',
        'apps/web/src/lib/shipping/server-shipping-quote-booking-economics-client.ts',
      ],
    ]);
  });
});
