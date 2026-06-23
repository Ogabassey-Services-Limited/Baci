import { describe, expect, it } from 'vitest';
import { GET } from './route';

function requestForHost(host: string): Request {
  return new Request('https://example.test/ads.txt', {
    headers: { host },
  });
}

describe('platform ads.txt route', () => {
  it('serves plain text with host-scoped caching headers', () => {
    const response = GET(requestForHost('unknown-merchant.com'));

    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8'
    );
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=86400'
    );
    expect(response.headers.get('vary')).toBe('Host');
  });

  it('authorizes the usebaci.com platform apex', async () => {
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

  it('authorizes the owned ogabassey.com flagship and its www host', async () => {
    for (const host of ['ogabassey.com', 'www.ogabassey.com']) {
      const response = GET(requestForHost(host));
      await expect(response.text()).resolves.toContain(
        'pub-9332275663101466, DIRECT'
      );
    }
  });

  it('ignores port suffixes and casing when matching owned hosts', async () => {
    const response = GET(requestForHost('Ogabassey.com:443'));

    await expect(response.text()).resolves.toContain(
      'pub-9332275663101466, DIRECT'
    );
  });

  it('returns the no-sellers stub for unrecognized third-party domains', async () => {
    const response = GET(requestForHost('some-third-party-store.com'));

    await expect(response.text()).resolves.toContain(
      'No authorized digital sellers'
    );
  });
});
