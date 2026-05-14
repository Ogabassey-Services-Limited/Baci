import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreatePublicClient,
  mockFetch,
  mockGetCachedFeatureSettings,
  mockGetCachedMerchant,
  mockGetCachedMerchantByDomain,
} = vi.hoisted(() => ({
  mockCreatePublicClient: vi.fn(),
  mockFetch: vi.fn(),
  mockGetCachedFeatureSettings: vi.fn(),
  mockGetCachedMerchant: vi.fn(),
  mockGetCachedMerchantByDomain: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN: 'https://cdn.ogabassey.com',
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  },
  getSupabaseAnonKey: () => 'anon-key',
  getSupabaseUrl: () => 'https://project.supabase.co',
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
  getCachedMerchant: (...args: unknown[]) => mockGetCachedMerchant(...args),
  getCachedMerchantByDomain: (...args: unknown[]) =>
    mockGetCachedMerchantByDomain(...args),
}));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

import {
  getMerchantBlogOgImageData,
  getMerchantBlogOgMetadataData,
} from './opengraph-image-data';

type PostRow = {
  title: string | null;
  category: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author_name: string | null;
  featured_image_width: number | null;
  featured_image_height: number | null;
  featured_image_variants: Record<string, string>;
};

const merchant = {
  id: 'merchant-1',
  business_name: ' Ogabassey ',
  brand_colors: {
    background: '#101820',
    primary: '#2f6fed',
    accent: '#f5a623',
  },
  logo_url: 'https://cdn.ogabassey.com/media/merchant-1/logo.png',
};

const postRow: PostRow = {
  title: 'Best iPhone Deals',
  category: 'Smartphones',
  featured_image_url: 'https://cdn.ogabassey.com/media/merchant-1/blog/raw.jpg',
  featured_image_alt: 'iPhone on desk',
  author_name: 'Baci Editorial',
  featured_image_width: 1200,
  featured_image_height: 675,
  featured_image_variants: {
    landscape_16x9:
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload-token/landscape_16x9.webp',
  },
};

function createPostQuery(data: PostRow | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

function installPostQuery(data: PostRow | null, error: unknown = null) {
  const query = createPostQuery(data, error);
  const supabase = {
    from: vi.fn(() => query),
  };
  mockCreatePublicClient.mockReturnValue(supabase);
  return { query, supabase };
}

function imageResponse(contentType = 'image/webp', body = 'image-bytes') {
  return new Response(body, {
    headers: contentType ? { 'content-type': contentType } : undefined,
    status: 200,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  mockGetCachedMerchant.mockResolvedValue(merchant);
  mockGetCachedMerchantByDomain.mockResolvedValue(merchant);
  mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
  installPostQuery(postRow);
});

describe('merchant blog OG image data', () => {
  it('returns null without leaking merchant data when tenant or feature visibility fails', async () => {
    mockGetCachedMerchant.mockResolvedValueOnce(null);
    await expect(
      getMerchantBlogOgImageData('missing-shop', 'post-a')
    ).resolves.toBeNull();

    mockGetCachedMerchant.mockResolvedValueOnce({
      ...merchant,
      business_name: '   ',
    });
    await expect(
      getMerchantBlogOgImageData('blank-name-shop', 'post-a')
    ).resolves.toBeNull();

    mockGetCachedMerchant.mockResolvedValueOnce(merchant);
    mockGetCachedFeatureSettings.mockResolvedValueOnce({ blog_enabled: false });
    await expect(
      getMerchantBlogOgImageData('blog-disabled-shop', 'post-a')
    ).resolves.toBeNull();
  });

  it('returns null when merchant or feature visibility lookups time out', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    vi.useFakeTimers();
    mockGetCachedMerchant.mockReturnValueOnce(new Promise(() => undefined));
    const merchantTimeout = getMerchantBlogOgImageData(
      'merchant-timeout-shop',
      'post-a'
    );
    await vi.advanceTimersByTimeAsync(4000);
    await expect(merchantTimeout).resolves.toBeNull();

    vi.useRealTimers();
    vi.useFakeTimers();
    mockGetCachedFeatureSettings.mockReturnValueOnce(
      new Promise(() => undefined)
    );
    const featureTimeout = getMerchantBlogOgMetadataData(
      'feature-timeout-shop',
      'post-a'
    );
    await vi.advanceTimersByTimeAsync(4000);
    await expect(featureTimeout).resolves.toBeNull();

    consoleErrorSpy.mockRestore();
  });

  it('routes slug identifiers and domain identifiers through the correct merchant lookup', async () => {
    await getMerchantBlogOgMetadataData('shop-slug-route', 'post-slug-route');
    await getMerchantBlogOgMetadataData(
      'shop.example.com',
      'post-domain-route'
    );

    expect(mockGetCachedMerchant).toHaveBeenCalledWith('shop-slug-route');
    expect(mockGetCachedMerchantByDomain).toHaveBeenCalledWith(
      'shop.example.com'
    );
  });

  it('returns branded fallback data when the tenant is valid but the post is missing', async () => {
    mockFetch.mockResolvedValue(imageResponse('image/png', 'logo'));
    installPostQuery(null);

    await expect(
      getMerchantBlogOgImageData('ogabassey', 'missing-post')
    ).resolves.toEqual({
      merchantBusinessName: 'Ogabassey',
      merchantBrandColors: {
        background: '#101820',
        primary: '#2f6fed',
        accent: '#f5a623',
      },
      post: null,
      featuredDataUri: null,
      featuredImageStatus: 'source_missing',
      logoDataUri: `data:image/png;base64,${Buffer.from('logo').toString(
        'base64'
      )}`,
    });
  });

  it('prefers the Discover landscape variant and carries all render fields', async () => {
    mockFetch.mockResolvedValue(imageResponse('image/webp', 'image'));

    const result = await getMerchantBlogOgImageData('ogabassey', 'best-deals');

    expect(result).toMatchObject({
      merchantBusinessName: 'Ogabassey',
      merchantBrandColors: {
        background: '#101820',
        primary: '#2f6fed',
        accent: '#f5a623',
      },
      post: postRow,
      featuredDataUri: `data:image/webp;base64,${Buffer.from('image').toString(
        'base64'
      )}`,
      featuredImageStatus: 'loaded',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      postRow.featured_image_variants.landscape_16x9,
      expect.any(Object)
    );
  });

  it('falls back to the original featured image when no landscape variant exists', async () => {
    mockFetch.mockResolvedValue(imageResponse('image/jpeg', 'image'));
    installPostQuery({
      ...postRow,
      featured_image_variants: {},
    });

    await getMerchantBlogOgImageData('ogabassey-original', 'best-deals');

    expect(mockFetch).toHaveBeenCalledWith(
      postRow.featured_image_url,
      expect.any(Object)
    );
  });

  it('logs and returns null when the post query fails', async () => {
    const error = new Error('boom');
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    installPostQuery(null, error);

    await expect(
      getMerchantBlogOgImageData('ogabassey-error', 'best-deals')
    ).resolves.toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch blog post for OG image',
      expect.objectContaining({
        merchantId: 'merchant-1',
        postSlug: 'best-deals',
        error,
      })
    );
    consoleErrorSpy.mockRestore();
  });

  it('uses a lightweight metadata helper that never buffers remote images', async () => {
    installPostQuery({
      ...postRow,
      title: 'Metadata Title',
    });

    await expect(
      getMerchantBlogOgMetadataData('ogabassey-meta', 'metadata-title')
    ).resolves.toEqual({
      merchantBusinessName: 'Ogabassey',
      post: {
        title: 'Metadata Title',
      },
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
