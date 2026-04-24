import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlogPostBody } from './BlogPostBody';

const { mockResolveBlogPostContent } = vi.hoisted(() => ({
  mockResolveBlogPostContent: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    alt: string;
    fill?: boolean;
    src: string;
    // biome-ignore lint/performance/noImgElement: test mock for next/image
  }) => <img alt={alt} src={src} {...props} />,
}));

vi.mock('@/components/blog/table-of-contents', () => ({
  TableOfContents: () => <nav aria-label="Table of contents">TOC</nav>,
}));

vi.mock('@/components/blog/renderer/BlogContentRenderer', () => ({
  BlogContentRenderer: ({ json }: { json: unknown }) => (
    <div data-testid="blog-json-renderer">{JSON.stringify(json)}</div>
  ),
}));

vi.mock('./blog-post-content', async () => {
  const actual = await vi.importActual('./blog-post-content');
  return {
    ...actual,
    resolveBlogPostContent: mockResolveBlogPostContent,
  };
});

describe('BlogPostBody', () => {
  afterEach(() => {
    mockResolveBlogPostContent.mockReset();
  });

  it('renders the structured JSON branch with tags and related posts', async () => {
    const content = { type: 'doc', content: [] };
    mockResolveBlogPostContent.mockResolvedValue({
      isJson: true,
      legacyHtml: '',
      renderedContent: { type: 'doc', content: [] },
    });

    render(
      await BlogPostBody({
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        content,
        merchantSlug: 'ogabassey',
        post: {
          id: 'post-1',
          slug: 'pixel-9-review',
          tags: ['Android', 'Google'],
          title: 'Pixel 9 Review',
        },
        relatedProducts: [],
        relatedPosts: [
          {
            id: 'related-1',
            slug: 'related-post',
            title: 'Related Post',
            category: 'Guides',
            featured_image_url: 'https://example.com/related.jpg',
            published_at: '2026-03-01T00:00:00.000Z',
            reading_time_minutes: 4,
          },
        ],
      })
    );

    expect(
      screen.getByRole('navigation', { name: /table of contents/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('blog-json-renderer')).toBeInTheDocument();
    expect(screen.getByText('Android')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(mockResolveBlogPostContent).toHaveBeenCalledWith(content, {
      basePath: '/ogabassey',
      baseUrl: 'https://usebaci.com',
      fallbackImageAlt: 'Pixel 9 Review',
      merchantSlug: 'ogabassey',
    });
    expect(
      screen.getByRole('link', { name: /Related Post/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Related Post' })
    ).toBeInTheDocument();
    expect(screen.getByText('4 min read')).toBeInTheDocument();
  });

  it('renders the legacy HTML branch and encodes share urls', async () => {
    mockResolveBlogPostContent.mockResolvedValue({
      isJson: false,
      legacyHtml: '<p>Legacy HTML body</p>',
      renderedContent: null,
    });

    render(
      await BlogPostBody({
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        content: '<p>Legacy HTML body</p>',
        merchantSlug: 'ogabassey',
        postUrl: 'https://usebaci.com/ogabassey/blog/pixel-9-review',
        post: {
          id: 'post-1',
          slug: 'pixel-9-review',
          tags: null,
          title: 'Pixel 9 Review',
        },
        relatedProducts: [],
        relatedPosts: [],
      })
    );

    expect(screen.getByTestId('blog-post-legacy-content').innerHTML).toContain(
      'Legacy HTML body'
    );

    const encodedTitle = encodeURIComponent('Pixel 9 Review');
    const encodedShareUrl = encodeURIComponent(
      'https://usebaci.com/ogabassey/blog/pixel-9-review'
    );

    expect(screen.getByRole('link', { name: 'Twitter' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodedShareUrl)
    );
    expect(screen.getByRole('link', { name: 'Twitter' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodedTitle)
    );
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodedShareUrl)
    );
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodedShareUrl)
    );
    expect(mockResolveBlogPostContent).toHaveBeenCalledWith(
      '<p>Legacy HTML body</p>',
      {
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        fallbackImageAlt: 'Pixel 9 Review',
        merchantSlug: 'ogabassey',
      }
    );
  });

  it('uses canonical postUrl for subdomain share links without doubled slug', async () => {
    mockResolveBlogPostContent.mockResolvedValue({
      isJson: false,
      legacyHtml: '<p>Content</p>',
      renderedContent: null,
    });

    render(
      await BlogPostBody({
        basePath: '/ogabassey',
        baseUrl: 'https://ogabassey.usebaci.com',
        content: '<p>Content</p>',
        merchantSlug: 'ogabassey',
        postUrl: 'https://ogabassey.usebaci.com/blog/my-post',
        post: {
          id: 'post-1',
          slug: 'my-post',
          tags: null,
          title: 'My Post',
        },
        relatedProducts: [],
        relatedPosts: [],
      })
    );

    // Share URL should be the canonical subdomain URL, NOT doubled like
    // https://ogabassey.usebaci.com/ogabassey/blog/my-post
    const expectedShareUrl = encodeURIComponent(
      'https://ogabassey.usebaci.com/blog/my-post'
    );

    expect(screen.getByRole('link', { name: 'Twitter' })).toHaveAttribute(
      'href',
      expect.stringContaining(expectedShareUrl)
    );
  });

  it('falls back to product id when related product slug is missing', async () => {
    mockResolveBlogPostContent.mockResolvedValue({
      isJson: false,
      legacyHtml: '<p>Content</p>',
      renderedContent: null,
    });

    render(
      await BlogPostBody({
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        content: '<p>Content</p>',
        merchantSlug: 'ogabassey',
        post: {
          id: 'post-1',
          slug: 'pixel-9-review',
          tags: null,
          title: 'Pixel 9 Review',
        },
        relatedProducts: [
          {
            id: 'product-with-slug',
            name: 'Product With Slug',
            slug: 'galaxy-s24',
            category_slug: 'smartphones',
          },
          {
            id: 'product-missing-slug',
            name: 'Product Missing Slug',
            slug: null,
            category_slug: null,
          },
          {
            id: 'product-empty-slug',
            name: 'Product Empty Slug',
            slug: '   ',
            category_slug: 'smartphones',
          },
        ],
        relatedPosts: [],
      })
    );

    expect(
      screen.getByRole('link', { name: 'Product With Slug' })
    ).toHaveAttribute('href', '/ogabassey/smartphones/galaxy-s24');
    expect(
      screen.getByRole('link', { name: 'Product Missing Slug' })
    ).toHaveAttribute('href', '/ogabassey/products/product-missing-slug');
    expect(
      screen.getByRole('link', { name: 'Product Empty Slug' })
    ).toHaveAttribute('href', '/ogabassey/smartphones/product-empty-slug');
  });
});
