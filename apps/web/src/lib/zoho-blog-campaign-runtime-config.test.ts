import { afterEach, describe, expect, it, vi } from 'vitest';
import { getZohoBlogCampaignRuntimeConfig } from './zoho-blog-campaign-runtime-config';

describe('getZohoBlogCampaignRuntimeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads and normalizes only the Zoho server runtime settings', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://usebaci.com/');
    vi.stubEnv('ZOHO_CAMPAIGNS_ENABLED', ' yes ');
    vi.stubEnv('ZOHO_CAMPAIGNS_AUTO_SEND', 'no');
    vi.stubEnv('ZOHO_CAMPAIGNS_FROM_NAME', '  Baci updates  ');
    vi.stubEnv('ZOHO_CAMPAIGNS_REQUEST_TIMEOUT_MS', '25000');

    expect(getZohoBlogCampaignRuntimeConfig()).toMatchObject({
      accountsServerUrl: 'https://accounts.zoho.com',
      apiRootUrl: 'https://campaigns.zoho.com/api/v1.1',
      autoSend: false,
      enabled: true,
      fromName: 'Baci updates',
      publicBaseUrl: 'https://usebaci.com/',
      redirectUri: 'https://usebaci.com/api/integrations/zoho/callback',
      requestTimeoutMs: 25_000,
    });
  });
});
