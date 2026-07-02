import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  mockBlogPostPageContent,
  mockConnection,
  mockDraftMode,
  mockGetBlogPostRedirect,
  mockGetCachedBlogPost,
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
  });

  it('renders streamed blog post content from the request-time subtree', async () => {
    render(await loadBlogPostPage('apple-studio-display-review'));

    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
  });

  it('passes the route params promise through to the content subtree untouched', async () => {
    const params = Promise.resolve({
      slug: 'ogabassey.com',
      postSlug: 'apple-studio-display-review',
    });
    const { default: BlogPostPage } = await import('./page');

    render(BlogPostPage({ params }));

    expect(mockBlogPostPageContent).toHaveBeenCalledOnce();
    const receivedProps = mockBlogPostPageContent.mock.calls[0][0] as {
      params: unknown;
    };
    expect(receivedProps.params).toBe(params);
  });

  it('keeps the page root free of request APIs and status lookups', async () => {
    // Static-shell contract: hard 404/308 belongs to the proxy blog-post
    // preflight and draft/not-found/redirect handling to the streamed
    // subtree. Any request API or lookup re-added at the page root forces
    // the route dynamic and reintroduces the per-request
    // NEXT_STATIC_GEN_BAILOUT this fix removed (PR #2882 regression).
    render(await loadBlogPostPage('any-slug-even-a-missing-one'));

    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
    expect(mockConnection).not.toHaveBeenCalled();
    expect(mockDraftMode).not.toHaveBeenCalled();
    expect(mockGetBlogPostRedirect).not.toHaveBeenCalled();
    expect(mockGetCachedBlogPost).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });
});
