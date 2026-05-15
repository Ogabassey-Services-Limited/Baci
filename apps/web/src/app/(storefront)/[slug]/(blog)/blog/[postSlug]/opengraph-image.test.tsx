import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetMerchantBlogOgImageData,
  mockGetMerchantBlogOgMetadataData,
  mockImageResponse,
} = vi.hoisted(() => ({
  mockGetMerchantBlogOgImageData: vi.fn(),
  mockGetMerchantBlogOgMetadataData: vi.fn(),
  mockImageResponse: vi.fn(function ImageResponse(
    element: unknown,
    options: unknown
  ) {
    return {
      element,
      options,
    };
  }),
}));

vi.mock('next/og', () => ({
  ImageResponse: mockImageResponse,
}));

vi.mock(
  '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data',
  () => ({
    getMerchantBlogOgImageData: (...args: unknown[]) =>
      mockGetMerchantBlogOgImageData(...args),
    getMerchantBlogOgMetadataData: (...args: unknown[]) =>
      mockGetMerchantBlogOgMetadataData(...args),
  })
);

import Image, {
  contentType,
  generateImageMetadata,
  revalidate,
  runtime,
  size,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image';
import type { MerchantBlogOgImageData } from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data';

function createData(
  overrides: Partial<MerchantBlogOgImageData> = {}
): MerchantBlogOgImageData {
  return {
    merchantBusinessName: 'Ogabassey',
    merchantBrandColors: {
      background: '#101820',
      primary: '#2f6fed',
      accent: '#f5a623',
    },
    post: {
      title: 'Best iPhone Deals',
      category: 'Smartphones',
      featured_image_url:
        'https://cdn.ogabassey.com/media/merchant-1/blog/raw.jpg',
      featured_image_alt: 'iPhone on desk',
      author_name: 'Baci Editorial',
      featured_image_width: 1200,
      featured_image_height: 675,
      featured_image_variants: {
        landscape_16x9:
          'https://cdn.ogabassey.com/media/merchant-1/blog/token/landscape_16x9.webp',
      },
    },
    featuredDataUri: 'data:image/jpeg;base64,ZmVhdHVyZWQ=',
    featuredImageStatus: 'loaded',
    logoDataUri: 'data:image/png;base64,bG9nbw==',
    ...overrides,
  };
}

function createDataPost(): NonNullable<MerchantBlogOgImageData['post']> {
  const post = createData().post;
  if (!post) throw new Error('Expected post');
  return post;
}
function renderImage(slug = 'ogabassey.com', postSlug = 'best-deals') {
  return Image({
    params: Promise.resolve({ slug, postSlug }),
  });
}

function getLastImageResponseCall() {
  const call = mockImageResponse.mock.calls.at(-1);
  if (!call) throw new Error('ImageResponse was not called');
  return {
    element: call[0] as React.ReactElement<{
      children?: unknown;
      style?: Record<string, unknown>;
    }>,
    options: call[1] as {
      headers?: HeadersInit;
    },
  };
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectText).join(' ');
  }
  if (typeof node === 'object' && 'props' in node) {
    return collectText(
      (node as { props: { children?: unknown } }).props.children
    );
  }
  return '';
}

function collectImageSources(node: unknown): string[] {
  if (node === null || node === undefined || typeof node !== 'object') {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectImageSources);
  }
  if ('type' in node && 'props' in node) {
    const element = node as {
      type: unknown;
      props: { children?: unknown; src?: unknown };
    };
    const ownSource =
      element.type === 'img' && typeof element.props.src === 'string'
        ? [element.props.src]
        : [];
    return [...ownSource, ...collectImageSources(element.props.children)];
  }
  return [];
}

function cacheControlOf(headers?: HeadersInit) {
  return headers ? new Headers(headers).get('cache-control') : null;
}

describe('merchant blog post OG image route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports PNG ImageResponse route metadata', () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe('image/png');
    expect(revalidate).toBe(0);
    expect(runtime).toBe('nodejs');
  });

  it('generates lightweight alt metadata for the post image', async () => {
    mockGetMerchantBlogOgMetadataData.mockResolvedValue({
      merchantBusinessName: 'Ogabassey',
      post: { title: 'Best iPhone Deals' },
    });

    await expect(
      generateImageMetadata({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          postSlug: 'best-deals',
        }),
      })
    ).resolves.toEqual([
      {
        id: 'merchant-blog-og',
        alt: 'Best iPhone Deals — Ogabassey',
        size,
        contentType,
      },
    ]);
    expect(mockGetMerchantBlogOgMetadataData).toHaveBeenCalledWith(
      'ogabassey.com',
      'best-deals'
    );
  });

  it('renders a no-store generic fallback when tenant data is unavailable', async () => {
    mockGetMerchantBlogOgImageData.mockResolvedValue(null);

    await renderImage();

    const { element, options } = getLastImageResponseCall();
    expect(collectText(element)).toContain('Post Not Found');
    expect(options).toMatchObject(size);
    expect(cacheControlOf(options.headers)).toBe('no-store, max-age=0');
  });

  it('renders a cacheable merchant-branded fallback when the post is missing', async () => {
    mockGetMerchantBlogOgImageData.mockResolvedValue(
      createData({ post: null })
    );

    await renderImage();

    const { element, options } = getLastImageResponseCall();
    const text = collectText(element);
    expect(text).toContain('Ogabassey');
    expect(text).toContain('Post Not Found');
    expect(collectImageSources(element)).toContain(
      'data:image/png;base64,bG9nbw=='
    );
    expect(cacheControlOf(options.headers)).toBeNull();
  });

  it('renders the primary blog card with the buffered featured image', async () => {
    mockGetMerchantBlogOgImageData.mockResolvedValue(createData());

    await renderImage('ogabassey.com', 'best-iphone-deals');

    const { element, options } = getLastImageResponseCall();
    const text = collectText(element);
    expect(text).toContain('Best iPhone Deals');
    expect(text).toContain('Smartphones');
    expect(text).toContain('Ogabassey');
    expect(collectImageSources(element)).toContain(
      'data:image/jpeg;base64,ZmVhdHVyZWQ='
    );
    expect(cacheControlOf(options.headers)).toBeNull();
  });

  it('uses no-store for transient image failures before rendering fallback art', async () => {
    mockGetMerchantBlogOgImageData.mockResolvedValue(
      createData({
        featuredDataUri: null,
        featuredImageStatus: 'timed_out',
      })
    );

    await renderImage();

    const { element, options } = getLastImageResponseCall();
    expect(collectText(element)).toContain('Best iPhone Deals');
    expect(cacheControlOf(options.headers)).toBe('no-store, max-age=0');
  });

  it('keeps permanent missing or disallowed image fallbacks cacheable', async () => {
    mockGetMerchantBlogOgImageData.mockResolvedValue(
      createData({
        featuredDataUri: null,
        featuredImageStatus: 'source_disallowed',
      })
    );

    await renderImage();

    const { options } = getLastImageResponseCall();
    expect(cacheControlOf(options.headers)).toBeNull();
  });

  it('truncates long rendered post titles without truncating alt metadata', async () => {
    const longTitle = `${'A'.repeat(100)} tail`;
    mockGetMerchantBlogOgImageData.mockResolvedValue(
      createData({ post: { ...createDataPost(), title: longTitle } })
    );
    mockGetMerchantBlogOgMetadataData.mockResolvedValue({
      merchantBusinessName: 'Ogabassey',
      post: { title: longTitle },
    });

    await renderImage();
    const { element } = getLastImageResponseCall();
    const [metadata] = await generateImageMetadata({
      params: Promise.resolve({ slug: 'ogabassey.com', postSlug: 'long' }),
    });

    expect(collectText(element)).toContain(`${longTitle.slice(0, 79)}...`);
    expect(metadata.alt).toBe(`${longTitle} — Ogabassey`);
  });

  it('omits optional category and author lines when post fields are null', async () => {
    mockGetMerchantBlogOgImageData.mockResolvedValue(
      createData({
        post: { ...createDataPost(), author_name: null, category: null },
      })
    );

    await renderImage();
    const text = collectText(getLastImageResponseCall().element);

    expect(text).not.toContain('Smartphones');
    expect(text).not.toContain('By Baci Editorial');
  });

  it('uses fallback brand colors when merchant colors are unavailable', async () => {
    mockGetMerchantBlogOgImageData.mockResolvedValue(
      createData({
        merchantBrandColors: { background: null, primary: null, accent: null },
        post: null,
      })
    );

    await renderImage();
    const { element, options } = getLastImageResponseCall();

    expect(element.props.style?.backgroundColor).toBe('#1a1a2e');
    expect(cacheControlOf(options.headers)).toBeNull();
  });

  it('normalizes short hex brand colors before using transparent gradient stops', async () => {
    mockGetMerchantBlogOgImageData.mockResolvedValue(
      createData({
        merchantBrandColors: {
          background: '#fff',
          primary: '#0af',
          accent: '#fc0',
        },
        post: null,
      })
    );

    await renderImage();
    const { element } = getLastImageResponseCall();
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];
    const overlay = children.filter(Boolean).find((child) => {
      const elementChild = child as React.ReactElement<{
        style?: Record<string, unknown>;
      }>;
      return elementChild.props?.style?.position === 'absolute';
    }) as
      | React.ReactElement<{
          style?: Record<string, unknown>;
        }>
      | undefined;

    expect(overlay?.props.style?.background).toContain(
      'rgba(0, 170, 255, 0.2)'
    );
    expect(overlay?.props.style?.background).toContain(
      'rgba(255, 204, 0, 0.15)'
    );
  });
});
