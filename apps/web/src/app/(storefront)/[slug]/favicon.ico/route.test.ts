import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type CachedMerchant, getMerchantSafe } from '@/lib/cached-data';
import { GET } from './route';

vi.mock('@/lib/cached-data', () => ({
  getMerchantSafe: vi.fn(),
}));

type FaviconMerchantFields = Pick<
  CachedMerchant,
  | 'favicon_apple_touch_url'
  | 'favicon_png_32_url'
  | 'favicon_svg_url'
  | 'logo_url'
>;

function createMerchant(
  overrides: Partial<FaviconMerchantFields>
): CachedMerchant {
  return {
    favicon_apple_touch_url: null,
    favicon_png_32_url: null,
    favicon_svg_url: null,
    logo_url: null,
    ...overrides,
  } as unknown as CachedMerchant;
}

function createRequest(url = 'https://ogabassey.com/favicon.ico') {
  return new Request(url) as unknown as NextRequest;
}

describe('Storefront Favicon Route Handler', () => {
  const ROOT_DOMAIN = 'usebaci.com';
  const fallbackUrl = `https://${ROOT_DOMAIN}/favicon.ico`;
  const cacheControl = 'public, max-age=300, stale-while-revalidate=600';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT_DOMAIN;
  });

  it('redirects to the absolute platform fallback if merchant is not found', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(null);

    const response = await GET(createRequest(), {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(fallbackUrl);
    expect(response.headers.get('Cache-Control')).toBe(cacheControl);
  });

  it('uses the incoming protocol for local platform fallback redirects', async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
    vi.mocked(getMerchantSafe).mockResolvedValue(null);

    const response = await GET(
      createRequest('http://localhost:3000/favicon.ico'),
      {
        params: Promise.resolve({ slug: 'ogabassey' }),
      }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/favicon.ico'
    );
    expect(response.headers.get('Cache-Control')).toBe(cacheControl);
  });

  it('prioritizes favicon_png_32_url and sets short caching headers', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(
      createMerchant({
        favicon_png_32_url:
          'https://storage.supabase.co/favicons/1/icon-32.png',
        favicon_svg_url: 'https://storage.supabase.co/favicons/1/icon.svg',
        logo_url: 'https://storage.supabase.co/logos/1/logo.png',
      })
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/favicons/1/icon-32.png'
    );
    expect(response.headers.get('Cache-Control')).toBe(cacheControl);
  });

  it('falls back to favicon_svg_url if png_32 is missing', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(
      createMerchant({
        favicon_svg_url: 'https://storage.supabase.co/favicons/1/icon.svg',
        logo_url: 'https://storage.supabase.co/logos/1/logo.png',
      })
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/favicons/1/icon.svg'
    );
  });

  it('falls back to logo_url if all specific favicons are missing', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(
      createMerchant({
        logo_url: 'https://storage.supabase.co/logos/1/logo.png',
      })
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/logos/1/logo.png'
    );
  });

  it('tries lower-priority favicon URLs after an invalid primary URL', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(getMerchantSafe).mockResolvedValue(
      createMerchant({
        favicon_png_32_url: 'javascript:alert(1)',
        favicon_svg_url: 'https://storage.supabase.co/favicons/1/icon.svg',
      })
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/favicons/1/icon.svg'
    );
  });

  it('avoids redirect loops when merchant favicon points to the current request', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(getMerchantSafe).mockResolvedValue(
      createMerchant({
        favicon_png_32_url: 'https://ogabassey.com/favicon.ico',
        logo_url: 'https://storage.supabase.co/logos/1/logo.png',
      })
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/logos/1/logo.png'
    );
  });

  it('avoids redirect loops when middleware rewrites a custom-domain root favicon request', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(getMerchantSafe).mockResolvedValue(
      createMerchant({
        favicon_png_32_url: 'https://ogabassey.com/favicon.ico',
      })
    );

    const request = createRequest(
      'https://ogabassey.com/ogabassey/favicon.ico'
    );
    request.headers.set('x-custom-domain', 'ogabassey.com');
    request.headers.set('x-merchant-domain', 'ogabassey.com');
    request.headers.set('x-merchant-slug', 'ogabassey');

    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(fallbackUrl);
    expect(response.headers.get('Cache-Control')).toBe(cacheControl);
  });

  it('safely falls back to platform favicon when all merchant urls are invalid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(getMerchantSafe).mockResolvedValue(
      createMerchant({
        favicon_png_32_url: 'javascript:alert(1)',
        logo_url: 'relative-path/logo.png',
      })
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(fallbackUrl);
    expect(response.headers.get('Cache-Control')).toBe(cacheControl);
  });
});
