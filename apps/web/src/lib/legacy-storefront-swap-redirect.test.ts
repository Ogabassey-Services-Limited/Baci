import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { redirectLegacyStorefrontSwap } from '@/lib/legacy-storefront-swap-redirect';

describe('redirectLegacyStorefrontSwap', () => {
  it('keeps platform-domain redirects slug-prefixed', () => {
    const response = redirectLegacyStorefrontSwap(
      new NextRequest(
        'https://usebaci.com/storefront/test-store/swap?ref=audit'
      ),
      'Test-Store'
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://usebaci.com/test-store/swap?ref=audit'
    );
  });

  it('redirects merchant custom domains to the domain-root swap page', () => {
    const response = redirectLegacyStorefrontSwap(
      new NextRequest(
        'https://shop.example/storefront/test-store/swap?ref=audit'
      ),
      'test-store'
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://shop.example/swap?ref=audit'
    );
  });

  it('redirects merchant subdomains to the subdomain-root swap page', () => {
    const response = redirectLegacyStorefrontSwap(
      new NextRequest('https://test-store.usebaci.com/storefront/test/swap'),
      'test-store'
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://test-store.usebaci.com/swap'
    );
  });

  it('rejects invalid legacy storefront slugs', async () => {
    const response = redirectLegacyStorefrontSwap(
      new NextRequest('https://usebaci.com/storefront/bad!!slug/swap'),
      'bad!!slug'
    );

    await expect(response.json()).resolves.toEqual({
      error: 'Invalid storefront slug',
    });
    expect(response.status).toBe(400);
  });
});
