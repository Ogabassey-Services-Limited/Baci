import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCachedContentLinkRewrites, mockGetCachedDeadContentLinkSlugs } =
  vi.hoisted(() => ({
    mockGetCachedContentLinkRewrites: vi.fn(),
    mockGetCachedDeadContentLinkSlugs: vi.fn(),
  }));

vi.mock('@/lib/cached-content-link-rewrites', () => ({
  getCachedContentLinkRewrites: (...args: unknown[]) =>
    mockGetCachedContentLinkRewrites(...args),
}));
vi.mock('@/lib/cached-dead-content-links', () => ({
  getCachedDeadContentLinkSlugs: (...args: unknown[]) =>
    mockGetCachedDeadContentLinkSlugs(...args),
}));

import { resolveContentLinks } from './blog-content-link-resolution';

const CONTENT_WITH_LINKS =
  '<p><a href="/blog/renamed-post">Old post</a> and ' +
  '<a href="/audio/apple-airpods-2">AirPods</a> and ' +
  '<a href="/smartphones/gone-forever">Gone</a></p>';

describe('resolveContentLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedDeadContentLinkSlugs.mockResolvedValue({
      blog: [],
      products: [],
    });
    mockGetCachedContentLinkRewrites.mockResolvedValue({
      blogSlugs: {},
      productPaths: {},
    });
  });

  it('returns empty outcomes without queries when there is no merchant', async () => {
    const result = await resolveContentLinks(
      CONTENT_WITH_LINKS,
      undefined,
      'store'
    );

    expect(result.deadContentLinks).toEqual({ blog: [], products: [] });
    expect(mockGetCachedDeadContentLinkSlugs).not.toHaveBeenCalled();
    expect(mockGetCachedContentLinkRewrites).not.toHaveBeenCalled();
  });

  it('excludes rewritable slugs from the dead sets', async () => {
    mockGetCachedDeadContentLinkSlugs.mockResolvedValue({
      blog: ['renamed-post'],
      products: ['apple-airpods-2', 'gone-forever'],
    });
    mockGetCachedContentLinkRewrites.mockResolvedValue({
      blogSlugs: { 'renamed-post': 'new-post' },
      productPaths: { 'apple-airpods-2': '/earbuds/apple-airpods-2' },
    });

    const result = await resolveContentLinks(
      CONTENT_WITH_LINKS,
      'merchant-1',
      'store'
    );

    expect(result.deadContentLinks).toEqual({
      blog: [],
      products: ['gone-forever'],
    });
    expect(result.rewrites.blogSlugs['renamed-post']).toBe('new-post');
  });

  it('fails open per resolver on transient errors', async () => {
    mockGetCachedDeadContentLinkSlugs.mockRejectedValue(new Error('boom'));
    mockGetCachedContentLinkRewrites.mockResolvedValue({
      blogSlugs: {},
      productPaths: { 'apple-airpods-2': '/earbuds/apple-airpods-2' },
    });

    const result = await resolveContentLinks(
      CONTENT_WITH_LINKS,
      'merchant-1',
      'store'
    );

    expect(result.deadContentLinks).toEqual({ blog: [], products: [] });
    expect(result.rewrites.productPaths['apple-airpods-2']).toBe(
      '/earbuds/apple-airpods-2'
    );
  });
});
