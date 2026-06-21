import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlogPostBody } from './blog-post-body';

vi.mock('@/components/ui/safe-html', () => ({
  SafeHtml: ({ html, ...rest }: { html: string; [key: string]: unknown }) => (
    <div data-testid="safe-html" data-html={html} {...rest} />
  ),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: (dirty: string) => dirty,
}));

vi.mock('@/components/blog/renderer/BlogContentRenderer', () => ({
  BlogContentRenderer: ({
    priorityInlineImageSrc,
  }: {
    priorityInlineImageSrc?: string | null;
  }) => (
    <div
      data-testid="blog-content-renderer"
      data-priority-inline-image-src={
        priorityInlineImageSrc === null
          ? 'null'
          : priorityInlineImageSrc || 'auto'
      }
    />
  ),
}));

vi.mock('@/components/blog/table-of-contents', () => ({
  TableOfContents: () => <nav aria-label="Table of contents" />,
}));

const BASE_POST = {
  author_bio: null as string | null,
  id: 'post-1',
  slug: 'pixel-9-review',
  tags: null as string[] | null,
  title: 'Pixel 9 Review',
};

const BASE_PROPS = {
  basePath: '/ogabassey',
  baseUrl: 'https://usebaci.com',
  post: BASE_POST,
  relatedPosts: [],
  relatedProducts: [],
};

describe('BlogPostBody inline image handling', () => {
  it('does not prioritize body inline images when a featured image is already rendered', async () => {
    render(
      await BlogPostBody({
        ...BASE_PROPS,
        content: { type: 'doc', content: [] },
        post: {
          ...BASE_POST,
          featured_image_url: 'https://cdn.ogabassey.com/blog/featured.png',
        },
      })
    );

    expect(screen.getByTestId('blog-content-renderer')).toHaveAttribute(
      'data-priority-inline-image-src',
      'null'
    );
  });

  it('removes only a leading legacy image that duplicates the featured image', async () => {
    const featuredImageUrl = 'https://cdn.ogabassey.com/blog/featured.png';

    render(
      await BlogPostBody({
        ...BASE_PROPS,
        content: `<p><img src="${featuredImageUrl}" alt="Hero" /></p><p>Body</p>`,
        post: { ...BASE_POST, featured_image_url: featuredImageUrl },
      })
    );

    expect(screen.getByTestId('safe-html')).toHaveAttribute(
      'data-html',
      '<p>Body</p>'
    );
  });
});
