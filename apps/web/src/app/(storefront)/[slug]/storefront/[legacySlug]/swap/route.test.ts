import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET, HEAD } from './route';

function createRequest(url: string) {
  return new NextRequest(url);
}

function createContext(slug: string, legacySlug: string) {
  return {
    params: Promise.resolve({ legacySlug, slug }),
  };
}

describe('GET /[slug]/storefront/[legacySlug]/swap', () => {
  it('redirects the rewritten Ogabassey custom-domain legacy path to the root swap route', async () => {
    const response = await GET(
      createRequest(
        'https://ogabassey.com/ogabassey.com/storefront/ogabassey/swap'
      ),
      createContext('ogabassey.com', 'ogabassey')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://ogabassey.com/swap');
  });

  it('keeps non-Ogabassey rewritten legacy paths under the merchant slug', async () => {
    const response = await GET(
      createRequest(
        'https://demo.example.com/demo.example.com/storefront/test-store/swap?ref=audit'
      ),
      createContext('demo.example.com', 'test-store')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://demo.example.com/test-store/swap?ref=audit'
    );
  });

  it('returns 400 when the rewritten legacy slug is invalid', async () => {
    const response = await GET(
      createRequest(
        'https://ogabassey.com/ogabassey.com/storefront/bad_slug/swap'
      ),
      createContext('ogabassey.com', 'bad_slug')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid storefront slug',
    });
  });

  it('handles HEAD like GET for crawlers checking the rewritten legacy path', async () => {
    const response = await HEAD(
      createRequest(
        'https://www.ogabassey.com/ogabassey.com/storefront/ogabassey/swap'
      ),
      createContext('ogabassey.com', 'ogabassey')
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://www.ogabassey.com/swap'
    );
  });
});
