import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  liveBlogPost,
  mockBuildStoreUrl,
  mockConnection,
  mockDraftMode,
  mockGetBlogPostRedirect,
  mockGetBlogPostTextPreview,
  mockGetCachedBlogPost,
  mockNotFound,
  mockPermanentRedirect,
  resetBlogPostPageMocks,
} from './page.test-utils';

async function generateBlogPostMetadata(postSlug: string) {
  const { generateMetadata } = await import('./page');

  return generateMetadata({
    params: Promise.resolve({
      slug: 'ogabassey.com',
      postSlug,
    }),
  });
}

describe('storefront blog post metadata', () => {
  beforeEach(() => {
    resetBlogPostPageMocks();
  });

  it('resolves public metadata without consulting draft request state', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: true });
    mockGetCachedBlogPost.mockResolvedValue(liveBlogPost);

    const metadata = await generateBlogPostMetadata(
      'apple-studio-display-review'
    );

    expect(mockDraftMode).not.toHaveBeenCalled();
    expect(mockGetCachedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'apple-studio-display-review',
      false
    );
    expect(metadata.title).toBe('The Great 5K Stall | Ogabassey');
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/apple-studio-display-review'
    );
    expect(mockConnection).not.toHaveBeenCalled();
  });

  it('uses the cached blog query when metadata is already available', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockGetCachedBlogPost.mockResolvedValue(liveBlogPost);

    const metadata = await generateBlogPostMetadata(
      'apple-studio-display-review'
    );

    expect(mockGetCachedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'apple-studio-display-review',
      false
    );
    expect(metadata.title).toBe('The Great 5K Stall | Ogabassey');
  });

  it('bounds long blog post title and description metadata', async () => {
    mockGetCachedBlogPost.mockResolvedValue({
      ...liveBlogPost,
      post: {
        ...liveBlogPost.post,
        title:
          'Best Phones Under 500000 Naira in Nigeria With Camera Battery and Gaming Performance Compared',
        excerpt:
          'Compare the best phones under 500000 naira in Nigeria with camera quality, battery life, gaming performance, warranty coverage, delivery options, and flexible payment notes for shoppers.',
      },
    });

    const metadata = await generateBlogPostMetadata('best-phones-under-500000');

    expect(String(metadata.title).length).toBeLessThanOrEqual(70);
    expect(String(metadata.title)).toContain('Ogabassey');
    expect(typeof metadata.description).toBe('string');
    if (typeof metadata.description !== 'string') {
      throw new TypeError('metadata.description must be a string');
    }
    expect(metadata.description.length).toBeLessThanOrEqual(160);
  });

  it('uses fallback blog description metadata when source text is empty', async () => {
    mockGetBlogPostTextPreview.mockReturnValueOnce('');
    mockGetCachedBlogPost.mockResolvedValue({
      ...liveBlogPost,
      post: {
        ...liveBlogPost.post,
        seo_description: '',
        excerpt: '',
        content: '',
      },
    });

    const metadata = await generateBlogPostMetadata('empty-description');

    expect(metadata.description).toContain(
      'Read The Great 5K Stall from Ogabassey'
    );
    expect(typeof metadata.description).toBe('string');
    if (typeof metadata.description !== 'string') {
      throw new TypeError('metadata.description must be a string');
    }
    expect(metadata.description.length).toBeLessThanOrEqual(160);
  });

  it('preserves short blog metadata that is already within bounds', async () => {
    const boundedDescription =
      'A practical buying guide for Nigerian shoppers comparing display quality, delivery confidence, warranty support, and upgrade timing.';
    mockGetCachedBlogPost.mockResolvedValue({
      ...liveBlogPost,
      post: {
        ...liveBlogPost.post,
        seo_title: 'Studio Display Review',
        seo_description: boundedDescription,
      },
    });

    const metadata = await generateBlogPostMetadata('studio-display-review');

    expect(metadata.title).toBe('Studio Display Review | Ogabassey');
    expect(metadata.description).toBe(boundedDescription);
  });

  it('keeps min-length blog descriptions when they are already descriptive', async () => {
    const descriptiveSummary =
      'Compare phone options by camera quality, battery life, warranty confidence, delivery timing, payment flexibility, and everyday value.';
    expect(descriptiveSummary.length).toBeGreaterThanOrEqual(110);
    expect(descriptiveSummary.length).toBeLessThanOrEqual(160);
    mockGetCachedBlogPost.mockResolvedValue({
      ...liveBlogPost,
      post: {
        ...liveBlogPost.post,
        seo_description: descriptiveSummary,
      },
    });

    const metadata = await generateBlogPostMetadata('descriptive-summary');

    expect(metadata.description).toBe(descriptiveSummary);
  });

  it('returns noindex fallback metadata when the public cache lookup throws', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockGetCachedBlogPost.mockRejectedValue(new Error('Cache lookup failed'));

    const metadata = await generateBlogPostMetadata(
      'apple-studio-display-review'
    );

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching cached public blog metadata',
      expect.objectContaining({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
        error: expect.any(Error),
      })
    );
    consoleErrorSpy.mockRestore();
  });

  it('returns noindex fallback metadata when only draft content may exist', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: true });
    mockGetCachedBlogPost.mockResolvedValue(null);

    const metadata = await generateBlogPostMetadata('draft-only-post');

    expect(mockDraftMode).toHaveBeenCalledOnce();
    expect(mockGetBlogPostRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('permanently redirects retired slugs from metadata before streaming starts', async () => {
    mockGetCachedBlogPost.mockResolvedValue(null);
    mockGetBlogPostRedirect.mockResolvedValue({
      merchant: {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      },
      targetSlug: 'canonical-post',
    });

    await expect(generateBlogPostMetadata('retired-post')).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:https://ogabassey.com/blog/canonical-post'
    );

    expect(mockConnection).toHaveBeenCalledOnce();
    expect(mockDraftMode).toHaveBeenCalledOnce();
    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      'https://ogabassey.com/blog/canonical-post'
    );
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it('hard-404s missing public slugs from metadata before the parent shell streams', async () => {
    mockGetCachedBlogPost.mockResolvedValue(null);
    mockGetBlogPostRedirect.mockResolvedValue(null);

    await expect(generateBlogPostMetadata('missing-post')).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );

    expect(mockConnection).toHaveBeenCalledOnce();
    expect(mockDraftMode).toHaveBeenCalledOnce();
    expect(mockGetBlogPostRedirect).toHaveBeenCalledWith(
      'ogabassey.com',
      'missing-post'
    );
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it('keeps noindex fallback metadata when redirect lookup fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const redirectError = new Error('Redirect lookup failed');
    mockGetCachedBlogPost.mockResolvedValue(null);
    mockGetBlogPostRedirect.mockRejectedValue(redirectError);

    const metadata = await generateBlogPostMetadata('retired-post');

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Blog redirect lookup failed in metadata',
      expect.objectContaining({
        slug: 'ogabassey.com',
        postSlug: 'retired-post',
        error: redirectError,
      })
    );
    consoleErrorSpy.mockRestore();
  });

  it('uses canonical URL from buildCanonicalBlogPostUrl for custom domains', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockGetCachedBlogPost.mockResolvedValue({
      ...liveBlogPost,
      merchant: {
        ...liveBlogPost.merchant,
        custom_domain: 'ogabassey.com',
      },
    });

    const metadata = await generateBlogPostMetadata(
      'apple-studio-display-review'
    );

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/apple-studio-display-review'
    );
  });

  it('uses the explicit social image route for OpenGraph and Twitter metadata', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockBuildStoreUrl.mockReturnValue('http://localhost:3000/ogabassey');
    mockGetCachedBlogPost.mockResolvedValue({
      ...liveBlogPost,
      merchant: {
        ...liveBlogPost.merchant,
        custom_domain: null,
        slug: 'ogabassey',
      },
    });

    const metadata = await generateBlogPostMetadata(
      'apple-studio-display-review'
    );

    expect(metadata.openGraph?.images).toEqual([
      {
        alt: 'The Great 5K Stall — Ogabassey',
        height: 630,
        type: 'image/png',
        url: 'http://localhost:3000/ogabassey/blog/apple-studio-display-review/opengraph-image',
        width: 1200,
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'http://localhost:3000/ogabassey/blog/apple-studio-display-review/opengraph-image',
    ]);
  });
});
