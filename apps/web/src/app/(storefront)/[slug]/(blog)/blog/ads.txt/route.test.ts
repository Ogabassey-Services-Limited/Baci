import { describe, expect, it } from 'vitest';
import { GET } from './route';

function requestForHost(host: string): Request {
  return new Request('https://example.test/blog/ads.txt', {
    headers: { host },
  });
}

describe('storefront blog ads.txt route', () => {
  it('shares the storefront ads.txt text response shape', () => {
    const response = GET(requestForHost('unknown-merchant.com'));

    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8'
    );
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=3600, s-maxage=86400'
    );
    expect(response.headers.get('vary')).toBe('Host');
  });

  it('returns the no-sellers stub for unrecognized hosts', async () => {
    const response = GET(requestForHost('unknown-merchant.com'));

    await expect(response.text()).resolves.toContain(
      'No authorized digital sellers'
    );
  });

  it('authorizes the platform AdSense account on owned hosts', async () => {
    const response = GET(requestForHost('usebaci.com'));

    await expect(response.text()).resolves.toContain(
      'pub-9332275663101466, DIRECT'
    );
  });
});
