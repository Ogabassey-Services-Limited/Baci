import { describe, expect, it } from 'vitest';
import { GET } from './route';

function requestForHost(host: string): Request {
  return new Request('https://example.test/ads.txt', {
    headers: { host },
  });
}

describe('storefront ads.txt route', () => {
  it('serves plain text with caching headers without rendering the storefront page', () => {
    const response = GET(requestForHost('unknown-merchant.com'));

    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8'
    );
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=86400'
    );
    expect(response.headers.get('vary')).toBe('Host');
  });

  it('returns the no-sellers stub for an unrecognized custom domain', async () => {
    const response = GET(requestForHost('some-third-party-store.com'));

    await expect(response.text()).resolves.toContain(
      'No authorized digital sellers'
    );
  });

  it('authorizes the platform AdSense account on the usebaci.com apex', async () => {
    const response = GET(requestForHost('usebaci.com'));

    await expect(response.text()).resolves.toBe(
      'google.com, pub-9332275663101466, DIRECT, f08c47fec0942fa0\n'
    );
  });

  it('authorizes every *.usebaci.com merchant subdomain', async () => {
    const response = GET(requestForHost('cool-merchant.usebaci.com'));

    await expect(response.text()).resolves.toContain(
      'pub-9332275663101466, DIRECT'
    );
  });

  it('authorizes the owned ogabassey.com flagship domain', async () => {
    const response = GET(requestForHost('ogabassey.com'));

    await expect(response.text()).resolves.toContain(
      'pub-9332275663101466, DIRECT'
    );
  });

  it('ignores port suffixes and casing when matching owned hosts', async () => {
    const response = GET(requestForHost('Ogabassey.com:443'));

    await expect(response.text()).resolves.toContain(
      'pub-9332275663101466, DIRECT'
    );
  });
});
