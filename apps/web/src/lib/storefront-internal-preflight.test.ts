import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storefrontInternalPreflight } from './storefront-internal-preflight';

const ORIGINAL_ENV = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

function restoreEnv() {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (key === 'NODE_ENV') continue;
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearEnv() {
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  vi.stubEnv('NODE_ENV', 'test');
}

const CONTEXT = {
  surface: 'product-slug' as const,
  identifier: 'ogabassey.com',
  slug: 'missing-product',
};

describe('storefrontInternalPreflight', () => {
  beforeEach(() => {
    clearEnv();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('routes through the public root domain instead of generated Vercel hosts', () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    process.env.VERCEL_URL = 'baci-protected.vercel.app';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'baci-prod.vercel.app';

    expect(
      storefrontInternalPreflight.resolveBaseUrl('https://ogabassey.com')
    ).toBe('https://usebaci.com');
  });

  it('uses the hardcoded public root fallback only for production deployments', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');

    expect(
      storefrontInternalPreflight.resolveBaseUrl('https://ogabassey.com')
    ).toBe('https://usebaci.com');

    clearEnv();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'preview');

    expect(
      storefrontInternalPreflight.resolveBaseUrl('https://ogabassey.com')
    ).toBeNull();
  });

  it('allows loopback origins for local development only', () => {
    expect(
      storefrontInternalPreflight.resolveBaseUrl('http://localhost:3000')
    ).toBe('http://localhost:3000');
    expect(
      storefrontInternalPreflight.resolveBaseUrl('https://ogabassey.com')
    ).toBeNull();
  });

  it('fails closed for redirects before JSON parsing', async () => {
    const result = await storefrontInternalPreflight.readJsonResponse(
      new Response('<!doctype html>', {
        headers: { 'Content-Type': 'text/html' },
        status: 302,
      }),
      CONTEXT
    );

    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'redirect', status: 302 })
    );
  });

  it('fails closed for non-JSON 200 responses before parsing HTML', async () => {
    const result = await storefrontInternalPreflight.readJsonResponse(
      new Response('<!doctype html>', {
        headers: { 'Content-Type': 'text/html' },
        status: 200,
      }),
      CONTEXT
    );

    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      '[storefront-internal-preflight] fail-open',
      expect.objectContaining({ reason: 'non-json', status: 200 })
    );
  });

  it('parses JSON responses', async () => {
    await expect(
      storefrontInternalPreflight.readJsonResponse(
        new Response(JSON.stringify({ hasError: false }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
        CONTEXT
      )
    ).resolves.toEqual({ hasError: false });
  });
});
