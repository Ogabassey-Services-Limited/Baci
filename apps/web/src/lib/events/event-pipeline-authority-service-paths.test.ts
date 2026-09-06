import { describe, expect, it } from 'vitest';
import { eventPipelineAdsServicePaths } from './event-pipeline-ads-service-paths';
import { eventPipelineAuthorityServicePaths } from './event-pipeline-authority-service-paths';

describe('eventPipelineAuthorityServicePaths', () => {
  it('extends ads service paths with the wallet funding-recovery HMAC edge', () => {
    expect(eventPipelineAuthorityServicePaths).toEqual([
      ...eventPipelineAdsServicePaths,
      [
        'apps/web/src/app/api/cron/provision-wallet-funding-recovery-hmac/route.ts',
        'apps/web/src/lib/wallet/server-funding-recovery-hmac-client.ts',
      ],
    ]);
  });
});
