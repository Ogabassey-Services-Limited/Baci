import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreatePublicClient,
  mockFetch,
  mockGetCachedMerchant,
  mockGetCachedMerchantByDomain,
} = vi.hoisted(() => ({
  mockCreatePublicClient: vi.fn(),
  mockFetch: vi.fn(),
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
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data';

type PostRow = {
  title: string | null;
  category: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author_name: string | null;
  featured_image_width: number | null;
  featured_image_height: number | null;
  featured_image_variants: Record<string, unknown>;
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
  feature_settings: { blog_enabled: true },
};

const postRow: PostRow = {
  title: 'Best iPhone Deals',
  category: 'Smartphones',
  featured_image_url: 'https://cdn.ogabassey.com/media/merchant-1/blog/raw.jpg',
  featured_image_alt: 'iPhone on desk',
  author_name: 'Baci Editorial',
  featured_image_width: 1200,
  featured_image_height: 675,
  featured_image_variants: {},
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
  mockCreatePublicClient.mockReturnValue({
    from: vi.fn(() => query),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  mockGetCachedMerchant.mockResolvedValue(merchant);
  mockGetCachedMerchantByDomain.mockResolvedValue(merchant);
  installPostQuery(postRow);
});

describe('merchant blog OG image data resolution', () => {
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

    mockGetCachedMerchant.mockResolvedValueOnce({
      ...merchant,
      feature_settings: { blog_enabled: false },
    });
    await expect(
      getMerchantBlogOgImageData('blog-disabled-shop', 'post-a')
    ).resolves.toBeNull();
  });

  it('returns null when the merchant snapshot lookup times out', async () => {
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

    consoleErrorSpy.mockRestore();
  });

  it('judges unsafe merchant slugs before any merchant or post lookup runs', async () => {
    let overEncodedSlug = 'x y';
    for (let index = 0; index < 10; index += 1) {
      overEncodedSlug = encodeURIComponent(overEncodedSlug);
    }

    await expect(
      getMerchantBlogOgImageData(overEncodedSlug, 'post-a')
    ).resolves.toBeNull();
    await expect(
      getMerchantBlogOgMetadataData('a'.repeat(4000), 'post-b')
    ).resolves.toBeNull();

    expect(mockGetCachedMerchant).not.toHaveBeenCalled();
    expect(mockGetCachedMerchantByDomain).not.toHaveBeenCalled();
    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('judges unsafe post slugs before any merchant or post lookup runs', async () => {
    let overEncodedPostSlug = 'x y';
    for (let index = 0; index < 10; index += 1) {
      overEncodedPostSlug = encodeURIComponent(overEncodedPostSlug);
    }

    await expect(
      getMerchantBlogOgImageData('safe-shop', overEncodedPostSlug)
    ).resolves.toBeNull();
    await expect(
      getMerchantBlogOgMetadataData('safe-shop-meta', 'a'.repeat(4000))
    ).resolves.toBeNull();

    expect(mockGetCachedMerchant).not.toHaveBeenCalled();
    expect(mockGetCachedMerchantByDomain).not.toHaveBeenCalled();
    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('still resolves a valid short slug through the merchant and post lookups', async () => {
    await expect(
      getMerchantBlogOgMetadataData('safe-valid-shop', 'best-deals-valid')
    ).resolves.toEqual({
      merchantBusinessName: 'Ogabassey',
      post: { title: 'Best iPhone Deals' },
    });

    expect(mockGetCachedMerchant).toHaveBeenCalledWith('safe-valid-shop');
    expect(mockCreatePublicClient).toHaveBeenCalled();
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
