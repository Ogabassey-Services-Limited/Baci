import { describe, expect, it, vi } from 'vitest';

const { mockGetRuntimeConfig } = vi.hoisted(() => ({
  mockGetRuntimeConfig: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('./zoho-blog-campaign-runtime-config', () => ({
  getZohoBlogCampaignRuntimeConfig: mockGetRuntimeConfig,
}));

import { getConfiguredZohoBlogContentConfig } from './zoho-blog-content-config-server';

describe('getConfiguredZohoBlogContentConfig', () => {
  it('returns the runtime configuration required to validate content signatures', () => {
    const runtimeConfig = {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      contentSecret: 'content-secret',
      refreshToken: 'refresh-token',
      publicBaseUrl: 'https://usebaci.com',
    };
    mockGetRuntimeConfig.mockReturnValue(runtimeConfig);

    expect(getConfiguredZohoBlogContentConfig()).toEqual({
      contentSecret: 'content-secret',
      publicBaseUrl: 'https://usebaci.com',
    });
  });
});
