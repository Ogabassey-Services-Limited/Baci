import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantSafe = vi.fn();
const mockCreatePublicClient = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantSafe: (...args: unknown[]) => mockGetMerchantSafe(...args),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

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

  it('returns a published target for a retired source slug', async () => {
    const redirectBuilder = createQueryBuilder({
      data: {
        target_post_id: 'post-1',
        target_slug: 'canonical-post',
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
    expect(postBuilder.eq).toHaveBeenCalledWith('status', 'published');
    expect(postBuilder.not).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('returns null when the redirect target is not public', async () => {
    const redirectBuilder = createQueryBuilder({
      data: {
        target_post_id: 'post-1',
        target_slug: 'draft-canonical',
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
});
