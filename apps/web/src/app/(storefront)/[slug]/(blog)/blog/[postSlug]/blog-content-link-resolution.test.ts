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

  it('suppresses unwrapping entirely when only the rewrites lookup fails', async () => {
    // apple-airpods-2 is dead per the slug query (archived) but would have a
    // rewrite to its parent — with the rewrites lookup down we cannot tell it
    // apart from a truly dead slug, so nothing may be unwrapped this render.
    mockGetCachedDeadContentLinkSlugs.mockResolvedValue({
      blog: [],
      products: ['apple-airpods-2', 'gone-forever'],
    });
    mockGetCachedContentLinkRewrites.mockRejectedValue(new Error('boom'));

    const result = await resolveContentLinks(
      CONTENT_WITH_LINKS,
      'merchant-1',
      'store'
    );

    expect(result.deadContentLinks).toEqual({ blog: [], products: [] });
    expect(result.rewrites).toEqual({ blogSlugs: {}, productPaths: {} });
  });

  it('keeps prototype-member-named dead slugs in the dead set', async () => {
    // 'constructor' resolves truthy via Object.prototype on a plain rewrite
    // map — the hasOwn guard must keep such slugs reported dead.
    mockGetCachedDeadContentLinkSlugs.mockResolvedValue({
      blog: ['constructor'],
      products: ['constructor'],
    });
    mockGetCachedContentLinkRewrites.mockResolvedValue({
      blogSlugs: {},
      productPaths: {},
    });

    const result = await resolveContentLinks(
      '<a href="/blog/constructor">C</a><a href="/audio/constructor">P</a>',
      'merchant-1',
      'ogabassey'
    );

    expect(result.deadContentLinks).toEqual({
      blog: ['constructor'],
      products: ['constructor'],
    });
  });
});

describe('resolveContentLinks prototype-key safety', () => {
  it('does not treat Object.prototype member names as having rewrites', async () => {
    mockGetCachedDeadContentLinkSlugs.mockResolvedValue({
      blog: ['constructor'],
      products: ['toString'],
    });
    mockGetCachedContentLinkRewrites.mockResolvedValue({
      blogSlugs: {},
      productPaths: {},
    });

    const result = await resolveContentLinks(
      '<a href="/blog/constructor">A</a><a href="/smartphones/toString">B</a>',
      'merchant-1',
      'store'
    );

    // bare bracket access would resolve inherited prototype members as
    // truthy "rewrites" and wrongly shield these dead slugs from unwrapping
    expect(result.deadContentLinks).toEqual({
      blog: ['constructor'],
      products: ['toString'],
    });
  });
});
