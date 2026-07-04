import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  mockBlogPostPageContent,
  mockBlogPostShell,
  mockConnection,
  mockDraftMode,
  mockGetBlogPostRedirect,
  mockNotFound,
  mockPermanentRedirect,
  mockPreloadBlogPostHero,
  mockResolveBlogPostHeroShell,
  mockResolveBlogPostStaticParams,
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

const heroShell = {
  blogHref: '/blog',
  hero: {
    alt: 'Best phones in Nigeria cover',
    src: 'https://cdn.ogabassey.com/media/blog/best-phones-cover.webp',
  },
  header: { title: 'Best Phones in Nigeria for 2026' },
};

describe('storefront blog post page', () => {
  beforeEach(() => {
    resetBlogPostPageMocks();
  });

  it('exports the route surface, including generateStaticParams', async () => {
    const routeModule = await import('./page');

    expect(Object.keys(routeModule).sort()).toEqual([
      'default',
      'generateMetadata',
      'generateStaticParams',
    ]);
  });

  it('delegates generateStaticParams to the prerender resolver', async () => {
    mockResolveBlogPostStaticParams.mockResolvedValue([
      { slug: 'ogabassey.com', postSlug: 'best-phones-in-nigeria' },
    ]);
    const { generateStaticParams } = await import('./page');

    await expect(generateStaticParams()).resolves.toEqual([
      { slug: 'ogabassey.com', postSlug: 'best-phones-in-nigeria' },
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

    render(await BlogPostPage({ params }));

    expect(mockBlogPostPageContent).toHaveBeenCalledOnce();
    const receivedProps = mockBlogPostPageContent.mock.calls[0][0] as {
      params: unknown;
    };
    expect(receivedProps.params).toBe(params);
  });

  it('keeps the page root free of request APIs and status lookups', async () => {
    // Static-shell contract: hard 404/308 belongs to the proxy blog-post
    // preflight and draft/not-found/redirect handling to the streamed subtree.
    // The only lookup allowed at the page root is the cached-only hero resolver
    // (getCachedBlogPost under the hood) — never a request API, which would
    // force the route dynamic and reintroduce the per-request
    // NEXT_STATIC_GEN_BAILOUT this fix removed (PR #2882 regression).
    render(await loadBlogPostPage('any-slug-even-a-missing-one'));

    expect(mockResolveBlogPostHeroShell).toHaveBeenCalledWith(
      'ogabassey.com',
      'any-slug-even-a-missing-one'
    );
    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
    expect(mockConnection).not.toHaveBeenCalled();
    expect(mockDraftMode).not.toHaveBeenCalled();
    expect(mockGetBlogPostRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it('hoists the cached hero + header into the static shell and streams the body', async () => {
    mockResolveBlogPostHeroShell.mockResolvedValue(heroShell);

    render(await loadBlogPostPage('best-phones-in-nigeria'));

    expect(mockPreloadBlogPostHero).toHaveBeenCalledWith(heroShell.hero.src);
    const shellProps = mockBlogPostShell.mock.calls[0]?.[0] as {
      hero: { src: string };
      header: { title: string };
    };
    expect(shellProps.hero.src).toBe(heroShell.hero.src);
    expect(shellProps.header.title).toBe('Best Phones in Nigeria for 2026');
    expect(mockBlogPostPageContent).toHaveBeenCalledWith(
      expect.objectContaining({ heroHoisted: true })
    );
    expect(screen.getByText('Blog post page content')).toBeInTheDocument();
  });

  it('paints the hoisted hero synchronously while the body region streams', async () => {
    mockResolveBlogPostHeroShell.mockResolvedValue(heroShell);
    mockBlogPostPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Suspend the streamed body so its fallback renders under the hero.
      });
    });

    render(await loadBlogPostPage('best-phones-in-nigeria'));

    expect(screen.getByTestId('shell-hero')).toHaveTextContent(
      heroShell.hero.src
    );
    expect(screen.getByText('Blog post body fallback')).toBeInTheDocument();
  });

  it('falls back to the full-Suspense render when there is no cached hero', async () => {
    mockResolveBlogPostHeroShell.mockResolvedValue(null);

    render(await loadBlogPostPage('imageless-post'));

    expect(mockBlogPostShell).not.toHaveBeenCalled();
    expect(mockPreloadBlogPostHero).not.toHaveBeenCalled();
    expect(mockBlogPostPageContent).toHaveBeenCalledWith(
      expect.not.objectContaining({ heroHoisted: true })
    );
  });
});
