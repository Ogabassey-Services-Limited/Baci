import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetPlatformBlogOgImageData, mockImageResponse } = vi.hoisted(
  () => ({
    mockGetPlatformBlogOgImageData: vi.fn(),
    mockImageResponse: vi.fn(function ImageResponse(
      element: unknown,
      options: unknown
    ) {
      return { element, options };
    }),
  })
);

vi.mock('next/og', () => ({
  ImageResponse: mockImageResponse,
}));

vi.mock('@/app/(platform)/blog/[slug]/opengraph-image-data', () => ({
  getPlatformBlogOgImageData: (...args: unknown[]) =>
    mockGetPlatformBlogOgImageData(...args),
  getPlatformBlogOgMetadataData: vi.fn(),
}));

import Image from '@/app/(platform)/blog/[slug]/opengraph-image';
import type { PlatformBlogOgImageData } from '@/app/(platform)/blog/[slug]/opengraph-image-data';

function createData(
  overrides: Partial<PlatformBlogOgImageData> = {}
): PlatformBlogOgImageData {
  return {
    businessName: 'Baci',
    featuredDataUri: 'data:image/jpeg;base64,ZmVhdHVyZWQ=',
    featuredImageStatus: 'loaded',
    logoDataUri: 'data:image/png;base64,bG9nbw==',
    post: {
      author_name: 'Baci Editorial',
      category: 'Guides',
      featured_image_alt: 'Launch cover',
      featured_image_height: 675,
      featured_image_url: 'https://usebaci.com/media/platform/blog/cover.jpg',
      featured_image_variants: {},
      featured_image_width: 1200,
      title: 'Launch Faster',
    },
    ...overrides,
  };
}

function getLastImageResponseCall() {
  const call = mockImageResponse.mock.calls.at(-1);
  if (!call) throw new Error('ImageResponse was not called');
  return {
    element: call[0] as {
      props?: {
        children?: unknown;
        style?: Record<string, unknown>;
      };
    },
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

describe('platform blog post OG image route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a no-store generic fallback when data resolution returns null', async () => {
    mockGetPlatformBlogOgImageData.mockResolvedValue(null);

    await Image({
      params: Promise.resolve({
        slug: 'missing-post',
      }),
    });

    const { element, options } = getLastImageResponseCall();
    expect(collectText(element)).toContain('Post Not Found');
    expect(cacheControlOf(options.headers)).toBe('no-store, max-age=0');
  });

  it('renders a cacheable branded fallback when the post is missing', async () => {
    mockGetPlatformBlogOgImageData.mockResolvedValue(
      createData({ post: null })
    );

    await Image({
      params: Promise.resolve({
        slug: 'missing-post',
      }),
    });

    const { element, options } = getLastImageResponseCall();
    expect(collectText(element)).toContain('Baci');
    expect(collectText(element)).toContain('Post Not Found');
    expect(collectImageSources(element)).toContain(
      'data:image/png;base64,bG9nbw=='
    );
    expect(cacheControlOf(options.headers)).toBeNull();
  });

  it('renders the primary card with the buffered featured image', async () => {
    mockGetPlatformBlogOgImageData.mockResolvedValue(createData());

    await Image({
      params: Promise.resolve({
        slug: 'launch-faster',
      }),
    });

    const { element } = getLastImageResponseCall();
    const text = collectText(element);
    expect(text).toContain('Launch Faster');
    expect(text).toContain('Guides');
    expect(text).toContain('Baci');
    expect(collectImageSources(element)).toContain(
      'data:image/jpeg;base64,ZmVhdHVyZWQ='
    );
  });

  it('uses no-store for transient image failures', async () => {
    mockGetPlatformBlogOgImageData.mockResolvedValue(
      createData({
        featuredDataUri: null,
        featuredImageStatus: 'timed_out',
      })
    );

    await Image({
      params: Promise.resolve({
        slug: 'launch-faster',
      }),
    });

    const { options } = getLastImageResponseCall();
    expect(cacheControlOf(options.headers)).toBe('no-store, max-age=0');
  });
});
