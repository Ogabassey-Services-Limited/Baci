import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantSafe } from '@/lib/cached-data';
import { GET } from './route';

vi.mock('@/lib/cached-data', () => ({
  getMerchantSafe: vi.fn(),
}));

type CachedMerchantResult = Awaited<ReturnType<typeof getMerchantSafe>>;

describe('Storefront Favicon Route Handler', () => {
  const ROOT_DOMAIN = 'usebaci.com';
  const fallbackUrl = `https://${ROOT_DOMAIN}/favicon.ico`;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT_DOMAIN;
  });

  it('redirects to the absolute platform fallback if merchant is not found', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(null);

    const request = new Request(
      'https://ogabassey.com/favicon.ico'
    ) as unknown as NextRequest;
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(fallbackUrl);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=600'
    );
  });

  it('prioritizes favicon_png_32_url and sets short caching headers', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      favicon_png_32_url: 'https://storage.supabase.co/favicons/1/icon-32.png',
      favicon_svg_url: 'https://storage.supabase.co/favicons/1/icon.svg',
      logo_url: 'https://storage.supabase.co/logos/1/logo.png',
    } as unknown as CachedMerchantResult);

    const request = new Request(
      'https://ogabassey.com/favicon.ico'
    ) as unknown as NextRequest;
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/favicons/1/icon-32.png'
    );
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=300, stale-while-revalidate=600'
    );
  });

  it('falls back to favicon_svg_url if png_32 is missing', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      favicon_png_32_url: null,
      favicon_svg_url: 'https://storage.supabase.co/favicons/1/icon.svg',
      logo_url: 'https://storage.supabase.co/logos/1/logo.png',
    } as unknown as CachedMerchantResult);

    const request = new Request(
      'https://ogabassey.com/favicon.ico'
    ) as unknown as NextRequest;
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/favicons/1/icon.svg'
    );
  });

  it('falls back to logo_url if all specific favicons are missing', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      favicon_png_32_url: null,
      favicon_svg_url: null,
      favicon_apple_touch_url: null,
      logo_url: 'https://storage.supabase.co/logos/1/logo.png',
    } as unknown as CachedMerchantResult);

    const request = new Request(
      'https://ogabassey.com/favicon.ico'
    ) as unknown as NextRequest;
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/logos/1/logo.png'
    );
  });

  it('tries lower-priority favicon URLs if the primary candidate is unsafe or malformed', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      favicon_png_32_url: 'javascript:alert(1)', // unsafe primary candidate
      favicon_svg_url: 'https://storage.supabase.co/favicons/1/icon.svg', // safe fallback candidate
      logo_url: 'https://storage.supabase.co/logos/1/logo.png',
    } as unknown as CachedMerchantResult);

    const request = new Request(
      'https://ogabassey.com/favicon.ico'
    ) as unknown as NextRequest;
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/favicons/1/icon.svg'
    );
  });

  it('avoids redirecting a favicon request to itself (loop prevention)', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      favicon_png_32_url: 'https://ogabassey.com/favicon.ico', // same host + pathname
      favicon_svg_url: 'https://storage.supabase.co/favicons/1/icon.svg', // fallback candidate
      logo_url: 'https://storage.supabase.co/logos/1/logo.png',
    } as unknown as CachedMerchantResult);

    const request = new Request(
      'https://ogabassey.com/favicon.ico'
    ) as unknown as NextRequest;
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://storage.supabase.co/favicons/1/icon.svg'
    );
  });

  it('resolves the fallback URL protocol dynamically from the request protocol', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/favicon.ico'
    ) as unknown as NextRequest;
    // Mock Next.js nextUrl property
    Object.defineProperty(request, 'nextUrl', {
      value: new URL('http://localhost:3000/favicon.ico'),
      writable: true,
    });

    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      `http://${ROOT_DOMAIN}/favicon.ico`
    );
  });
});
