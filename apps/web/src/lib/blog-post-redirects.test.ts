import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantSafe = vi.fn();
const mockCreatePublicClient = vi.fn();

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

vi.mock('@/lib/cached-data', () => ({
  getMerchantSafe: (...args: unknown[]) => mockGetMerchantSafe(...args),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

import { cacheLife, cacheTag } from 'next/cache';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { getBlogPostRedirect } from './blog-post-redirects';

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    not: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };

  return builder;
}

describe('getBlogPostRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantSafe.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
      logo_url: null,
      slug: 'ogabassey',
    });
  });

  it('returns null for empty source slugs before querying', async () => {
    await expect(getBlogPostRedirect('ogabassey.com', '')).resolves.toBeNull();
    await expect(
      getBlogPostRedirect('ogabassey.com', '  ')
    ).resolves.toBeNull();

    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('returns null when the merchant cannot be resolved', async () => {
    mockGetMerchantSafe.mockResolvedValueOnce(null);

    await expect(
      getBlogPostRedirect('Ogabassey.com', 'retired-post')
    ).resolves.toBeNull();

    expect(mockGetMerchantSafe).toHaveBeenCalledWith('ogabassey.com');
    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('returns a published target for a retired source slug', async () => {
    const redirectBuilder = createQueryBuilder({
      data: {
        target_post_id: 'post-1',
      },
      error: null,
    });
    const postBuilder = createQueryBuilder({
      data: { slug: 'canonical-post' },
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => redirectBuilder) })
      .mockReturnValueOnce({ select: vi.fn(() => postBuilder) });
    mockCreatePublicClient.mockReturnValue({ from });

    const result = await getBlogPostRedirect('ogabassey.com', ' Retired-Post ');

    expect(result).toEqual({
      merchant: {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        custom_domain: 'ogabassey.com',
        logo_url: null,
        slug: 'ogabassey',
      },
      targetSlug: 'canonical-post',
    });
    expect(mockGetMerchantSafe).toHaveBeenCalledWith('ogabassey.com');
    expect(redirectBuilder.eq).toHaveBeenCalledWith(
      'source_slug',
      'retired-post'
    );
    expect(cacheLife).toHaveBeenCalledWith('merchant');
    expect(cacheTag).toHaveBeenCalledWith(
      'blog-posts',
      getBlogCacheTag('ogabassey.com', 'retired-post')
    );
    expect(postBuilder.eq).toHaveBeenCalledWith('status', 'published');
    expect(postBuilder.not).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('resolves the current target slug without filtering by stale target slug', async () => {
    const redirectBuilder = createQueryBuilder({
      data: {
        target_post_id: 'post-1',
      },
      error: null,
    });
    const postBuilder = createQueryBuilder({
      data: { slug: 'renamed-canonical-post' },
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => redirectBuilder) })
      .mockReturnValueOnce({ select: vi.fn(() => postBuilder) });
    mockCreatePublicClient.mockReturnValue({ from });

    const result = await getBlogPostRedirect('ogabassey.com', 'retired-post');

    expect(result?.targetSlug).toBe('renamed-canonical-post');
    expect(postBuilder.eq).not.toHaveBeenCalledWith('slug', expect.any(String));
  });

  it('returns null when the redirect target is not public', async () => {
    const redirectBuilder = createQueryBuilder({
      data: {
        target_post_id: 'post-1',
      },
      error: null,
    });
    const postBuilder = createQueryBuilder({ data: null, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => redirectBuilder) })
      .mockReturnValueOnce({ select: vi.fn(() => postBuilder) });
    mockCreatePublicClient.mockReturnValue({ from });

    await expect(
      getBlogPostRedirect('ogabassey.com', 'retired-post')
    ).resolves.toBeNull();
  });

  it('returns null when no redirect row exists', async () => {
    const redirectBuilder = createQueryBuilder({
      data: null,
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => redirectBuilder) });
    mockCreatePublicClient.mockReturnValue({ from });

    await expect(
      getBlogPostRedirect('ogabassey.com', 'retired-post')
    ).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('throws when the redirect lookup fails', async () => {
    const redirectError = new Error('redirect query failed');
    const redirectBuilder = createQueryBuilder({
      data: null,
      error: redirectError,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => redirectBuilder) });
    mockCreatePublicClient.mockReturnValue({ from });

    await expect(
      getBlogPostRedirect('ogabassey.com', 'retired-post')
    ).rejects.toThrow('redirect query failed');
  });

  it('throws when the target post lookup fails', async () => {
    const targetPostError = new Error('target post query failed');
    const redirectBuilder = createQueryBuilder({
      data: {
        target_post_id: 'post-1',
      },
      error: null,
    });
    const postBuilder = createQueryBuilder({
      data: null,
      error: targetPostError,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select: vi.fn(() => redirectBuilder) })
      .mockReturnValueOnce({ select: vi.fn(() => postBuilder) });
    mockCreatePublicClient.mockReturnValue({ from });

    await expect(
      getBlogPostRedirect('ogabassey.com', 'retired-post')
    ).rejects.toThrow('target post query failed');
  });
});

describe('getBlogPostRedirect cache directive', () => {
  const blogRedirectSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'blog-post-redirects.ts'),
    'utf8'
  );

  it('reads per-request off the local cache handler, not the remote handler', () => {
    // PR4a: keyed on arbitrary crawler source slugs (unbounded remote keys)
    // behind two indexed reads on a 16-row table. Already fail-loud, so the
    // remote write buys nothing but the exit-128 hazard — keep it local.
    expect(blogRedirectSource).not.toContain("'use cache: remote';");
    expect(blogRedirectSource).toContain("'use cache';");
  });
});
