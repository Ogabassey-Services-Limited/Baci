import { describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getRootDomain: () => 'usebaci.com',
}));

import { resolveRouteIdentifier } from '@/lib/storefront-route-identifier';

function createHeaders(entries: [string, string][]) {
  return new Headers(entries) as unknown as Awaited<
    ReturnType<typeof import('next/headers').headers>
  >;
}

describe('resolveRouteIdentifier', () => {
  it('returns an empty string when no host header exists', () => {
    expect(resolveRouteIdentifier(createHeaders([]))).toBe('');
  });

  it('prefers the custom domain header', () => {
    expect(
      resolveRouteIdentifier(
        createHeaders([
          ['x-custom-domain', 'Ogabassey.com'],
          ['x-merchant-slug', 'ignored'],
        ])
      )
    ).toBe('ogabassey.com');
  });

  it('falls back to the merchant slug header', () => {
    expect(
      resolveRouteIdentifier(createHeaders([['x-merchant-slug', 'Ogabassey']]))
    ).toBe('ogabassey');
  });

  it('derives the slug from a root-domain subdomain host', () => {
    expect(
      resolveRouteIdentifier(
        createHeaders([['host', 'www.ogabassey.usebaci.com:3000']])
      )
    ).toBe('ogabassey');
  });

  it('returns the full host for external custom domains', () => {
    expect(
      resolveRouteIdentifier(createHeaders([['host', 'ogabassey.ng']]))
    ).toBe('ogabassey.ng');
  });

  it('returns an empty string for the bare root domain', () => {
    expect(
      resolveRouteIdentifier(createHeaders([['host', 'www.usebaci.com']]))
    ).toBe('');
  });

  it('returns an empty string for localhost development hosts', () => {
    expect(resolveRouteIdentifier(createHeaders([['host', 'localhost']]))).toBe(
      ''
    );
    expect(
      resolveRouteIdentifier(createHeaders([['host', 'localhost:3000']]))
    ).toBe('');
  });

  it('returns an empty string for loopback development hosts', () => {
    expect(resolveRouteIdentifier(createHeaders([['host', '127.0.0.1']]))).toBe(
      ''
    );
    expect(
      resolveRouteIdentifier(createHeaders([['host', '127.0.0.1:3000']]))
    ).toBe('');
  });
});
