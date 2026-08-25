import { describe, expect, it } from 'vitest';
import { eventPipelineAdsServicePaths } from './event-pipeline-ads-service-paths';

describe('eventPipelineAdsServicePaths', () => {
  it('limits privileged Ads spend delivery to the four provider sync routes', () => {
    expect(eventPipelineAdsServicePaths).toEqual([
      [
        'apps/web/src/app/api/integrations/ads/google/sync/route.ts',
        'apps/web/src/lib/ads/server-spend-client.ts',
      ],
      [
        'apps/web/src/app/api/integrations/ads/meta/sync/route.ts',
        'apps/web/src/lib/ads/server-spend-client.ts',
      ],
      [
        'apps/web/src/app/api/integrations/ads/snapchat/sync/route.ts',
        'apps/web/src/lib/ads/server-spend-client.ts',
      ],
      [
        'apps/web/src/app/api/integrations/ads/tiktok/sync/route.ts',
        'apps/web/src/lib/ads/server-spend-client.ts',
      ],
    ]);
  });
});
