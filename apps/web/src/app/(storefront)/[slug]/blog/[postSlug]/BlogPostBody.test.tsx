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
        post: {
          id: 'post-1',
          slug: 'pixel-9-review',
          tags: ['Android', 'Google'],
          title: 'Pixel 9 Review',
        },
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
    expect(mockResolveBlogPostContent).toHaveBeenCalledWith(content);
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
        post: {
          id: 'post-1',
          slug: 'pixel-9-review',
          tags: null,
          title: 'Pixel 9 Review',
        },
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
      '<p>Legacy HTML body</p>'
    );
  });
});
