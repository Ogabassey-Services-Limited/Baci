import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET, HEAD } from './route';

function createRequest(url: string) {
  return new NextRequest(url);
}

function createContext(slug: string) {
  return {
    params: Promise.resolve({ slug }),
  };
}

describe('GET /storefront/[slug]/swap', () => {
  it('redirects the legacy Ogabassey custom-domain path to the root swap route', async () => {
    const response = await GET(
      createRequest('https://ogabassey.com/storefront/ogabassey/swap'),
      createContext('ogabassey')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://ogabassey.com/swap');
  });

  it('redirects the legacy Ogabassey www custom-domain path to the root swap route', async () => {
    const response = await GET(
      createRequest('https://www.ogabassey.com/storefront/ogabassey/swap'),
      createContext('ogabassey')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://www.ogabassey.com/swap'
    );
  });

  it('keeps platform-host legacy paths under the merchant slug', async () => {
    const response = await GET(
      createRequest('https://usebaci.com/storefront/ogabassey/swap'),
      createContext('ogabassey')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://usebaci.com/ogabassey/swap'
    );
  });

  it('redirects custom-domain legacy paths to the root swap route', async () => {
    const response = await GET(
      createRequest('https://shop.example/storefront/test-store/swap'),
      createContext('test-store')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://shop.example/swap');
  });

  it('redirects merchant-subdomain legacy paths to the root swap route', async () => {
    const response = await GET(
      createRequest(
        'https://test-store.usebaci.com/storefront/test-store/swap'
      ),
      createContext('test-store')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://test-store.usebaci.com/swap'
    );
  });

  it('normalizes mixed-case slugs and preserves the request query string', async () => {
    const response = await GET(
      createRequest('https://usebaci.com/storefront/Test-Store/swap?ref=audit'),
      createContext('Test-Store')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://usebaci.com/test-store/swap?ref=audit'
    );
  });

  it('returns 400 when the legacy slug is whitespace only', async () => {
    const response = await GET(
      createRequest('https://usebaci.com/storefront/%20%20/swap'),
      createContext('  ')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid storefront slug',
    });
  });

  it('returns 400 when the legacy slug contains unsupported characters', async () => {
    const response = await GET(
      createRequest('https://usebaci.com/storefront/bad_slug/swap'),
      createContext('bad_slug')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid storefront slug',
    });
  });

  it('returns 400 when the legacy slug exceeds the merchant slug limit', async () => {
    const response = await GET(
      createRequest('https://usebaci.com/storefront/too-long/swap'),
      createContext('a'.repeat(255))
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid storefront slug',
    });
  });

  it('handles HEAD like GET for crawlers checking the legacy path', async () => {
    const response = await HEAD(
      createRequest('https://ogabassey.com/storefront/ogabassey/swap'),
      createContext('ogabassey')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://ogabassey.com/swap');
  });
});
