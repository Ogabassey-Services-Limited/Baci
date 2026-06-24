import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { BlogPostData } from '@/templates/registry';
import { BlogFeaturedStory } from './blog-featured-story';

interface MockNextImageProps {
  alt: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  fill?: boolean;
  loading?: 'eager' | 'lazy';
  preload?: boolean;
  priority?: boolean;
  sizes?: string;
  src: string;
}

vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority,
    fill,
    loading,
    preload,
    priority,
    sizes,
    src,
  }: MockNextImageProps) => (
    <img
      alt={alt}
      data-fetchpriority={fetchPriority}
      data-fill={fill ? 'true' : 'false'}
      data-loading={loading}
      data-preload={preload ? 'true' : 'false'}
      data-priority={priority ? 'true' : 'false'}
      data-sizes={sizes}
      src={src}
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('BlogFeaturedStory', () => {
  const featuredPost = {
    category: 'Tech News',
    excerpt: 'Useful buying guidance.',
    featured_image_url: 'https://example.com/original.jpg',
    id: 'post-1',
    published_at: '2026-06-24T00:00:00.000Z',
    slug: 'featured-post',
    title: 'Featured Post',
  } as BlogPostData;

  it('renders the featured story image as eager high-priority LCP content', () => {
    render(
      <BlogFeaturedStory
        basePath="/ogabassey"
        featuredPost={featuredPost}
        imageSrc="https://example.com/featured.jpg"
        publishedDateLabel="24 Jun 2026"
      />
    );

    const articleLink = screen.getByRole('link', { name: /featured post/i });
    expect(articleLink).toHaveAttribute('href', '/ogabassey/blog/featured-post');

    const image = screen.getByRole('img', { name: 'Featured Post' });
    expect(image).toHaveAttribute('src', 'https://example.com/featured.jpg');
    expect(image).toHaveAttribute('data-preload', 'false');
    expect(image).toHaveAttribute('data-loading', 'eager');
    expect(image).toHaveAttribute('data-fetchpriority', 'high');
    expect(image).toHaveAttribute('data-priority', 'false');
    expect(image).toHaveAttribute('data-fill', 'true');
    expect(image).toHaveAttribute('data-sizes', '100vw');
    expect(screen.getByText('24 Jun 2026')).toBeInTheDocument();
  });
});
