import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockBlogPostExistenceMaybeSingle,
  mockBlogPostPageContent,
  mockCacheLife,
  mockCacheTag,
  mockConnection,
  mockDraftMode,
  mockGetBlogPostRedirect,
  mockGetCachedBlogPost,
  mockGetLiveBlogPost,
  mockNotFound,
  mockPermanentRedirect,
  resetBlogPostPageMocks,
} from './page.test-utils';

async function loadBlogPostPage(postSlug: string) {
  const { default: BlogPostPage } = await import('./page');

  return BlogPostPage({
    params: Promise.resolve({
      slug: 'ogabassey.com',
      postSlug,
    }),
  });
}

describe('storefront blog post page', () => {
  beforeEach(() => {
    resetBlogPostPageMocks();
  });

  it('only exports the route surface from the page module', async () => {
    const routeModule = await import('./page');

    expect(Object.keys(routeModule).sort()).toEqual([
      'default',
      'generateMetadata',
    ]);
  });

  it('renders only the local shell while request-time blog content is pending', async () => {
    mockBlogPostPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Keep the blog post page content suspended behind its local shell.
      });
    });

    render(
      <Suspense fallback={<div>Route loader fallback</div>}>
        {await loadBlogPostPage('apple-studio-display-review')}
      </Suspense>
    );

    expect(screen.getByText('Blog post page fallback')).toBeInTheDocument();
    expect(screen.queryByText('Route loader fallback')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Blog post page content')
    ).not.toBeInTheDocument();
    expect(mockConnection).not.toHaveBeenCalled();
  });

  it('renders streamed blog post content without a page-level metadata marker', async () => {
    render(await loadBlogPostPage('apple-studio-display-review'));

    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
    expect(mockConnection).not.toHaveBeenCalled();
  });

  it('returns notFound for missing public blog post slugs outside draft mode', async () => {
    mockBlogPostExistenceMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(loadBlogPostPage('smartphones')).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );

    expect(mockDraftMode).toHaveBeenCalledOnce();
    expect(mockBlogPostExistenceMaybeSingle).toHaveBeenCalledOnce();
    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockGetLiveBlogPost).not.toHaveBeenCalled();
    expect(mockBlogPostPageContent).not.toHaveBeenCalled();
  });

  it('streams public posts without resolving full post data at the page boundary', async () => {
    render(await loadBlogPostPage('apple-studio-display-review'));

    expect(mockBlogPostExistenceMaybeSingle).toHaveBeenCalledOnce();
    expect(mockCacheLife).toHaveBeenCalledWith('blog');
    expect(mockCacheTag).toHaveBeenCalledWith(
      'blog-posts',
      expect.stringContaining('blog-ogabassey.com-apple-studio-display-review')
    );
    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockGetLiveBlogPost).not.toHaveBeenCalled();
    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
  });

  it('keeps streaming content when the lightweight existence check errors', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const lookupError = new Error('public post existence unavailable');
    mockBlogPostExistenceMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: lookupError,
    });

    render(await loadBlogPostPage('apple-studio-display-review'));

    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockGetLiveBlogPost).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error checking public blog post at page boundary',
      expect.objectContaining({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
        error: lookupError,
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('retries redirect lookup before notFound when public post is missing', async () => {
    const redirectLookupError = new Error('redirect store unavailable');
    mockGetBlogPostRedirect
      .mockRejectedValueOnce(redirectLookupError)
      .mockResolvedValueOnce({
        merchant: {
          id: 'merchant-1',
          business_name: 'Ogabassey',
          slug: 'ogabassey',
          custom_domain: 'ogabassey.com',
        },
        targetSlug: 'canonical-post',
      });
    mockBlogPostExistenceMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(loadBlogPostPage('retired-post')).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:https://ogabassey.com/blog/canonical-post'
    );

    expect(mockGetBlogPostRedirect).toHaveBeenCalledTimes(2);
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockBlogPostPageContent).not.toHaveBeenCalled();
  });

  it('propagates redirect retry errors before notFound when public post is missing', async () => {
    const firstError = new Error('redirect store unavailable');
    const retryError = new Error('redirect store still unavailable');
    mockGetBlogPostRedirect
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(retryError);
    mockBlogPostExistenceMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(loadBlogPostPage('retired-post')).rejects.toThrow(retryError);

    expect(mockGetBlogPostRedirect).toHaveBeenCalledTimes(2);
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockBlogPostPageContent).not.toHaveBeenCalled();
  });

  it('allows draft-mode blog slugs to render without a public post', async () => {
    mockDraftMode.mockResolvedValueOnce({ isEnabled: true });
    mockGetCachedBlogPost.mockResolvedValueOnce(null);

    render(await loadBlogPostPage('draft-only-post'));

    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
    expect(mockBlogPostExistenceMaybeSingle).not.toHaveBeenCalled();
    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockGetLiveBlogPost).not.toHaveBeenCalled();
  });

  it('permanently redirects retired blog slugs before rendering the streamed shell', async () => {
    mockGetBlogPostRedirect.mockResolvedValueOnce({
      merchant: {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      },
      targetSlug: 'canonical-post',
    });

    await expect(loadBlogPostPage('retired-post')).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:https://ogabassey.com/blog/canonical-post'
    );

    expect(mockGetBlogPostRedirect).toHaveBeenCalledWith(
      'ogabassey.com',
      'retired-post'
    );
    expect(mockBlogPostPageContent).not.toHaveBeenCalled();
  });

  it('keeps rendering canonical posts when redirect lookup fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const redirectLookupError = new Error('redirect store unavailable');
    mockGetBlogPostRedirect.mockRejectedValueOnce(redirectLookupError);

    render(await loadBlogPostPage('apple-studio-display-review'));

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Blog redirect lookup failed at page boundary',
      expect.objectContaining({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
        error: redirectLookupError,
      })
    );

    consoleErrorSpy.mockRestore();
  });
});
