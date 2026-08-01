import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

async function loadCredentials() {
  vi.resetModules();
  return import('./cloudflare-purge-credentials');
}

describe('getCloudflarePurgeCredentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns only the Cloudflare token and zone ID needed for an edge purge', async () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', ' cf-token ');
    vi.stubEnv('CLOUDFLARE_ZONE_ID', ' cf-zone ');

    const { getCloudflarePurgeCredentials } = await loadCredentials();

    expect(getCloudflarePurgeCredentials()).toEqual({
      token: 'cf-token',
      zoneId: 'cf-zone',
    });
  });

  it('withholds the capability when either Cloudflare credential is absent', async () => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'cf-token');
    vi.stubEnv('CLOUDFLARE_ZONE_ID', '');

    const { getCloudflarePurgeCredentials } = await loadCredentials();

    expect(getCloudflarePurgeCredentials()).toBeUndefined();
  });
});
