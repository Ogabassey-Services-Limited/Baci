import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({ default: () => <div data-testid="image" /> }));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { BlogPostCard } from './blog-post-card';

describe('BlogPostCard', () => {
  it('renders published content, category, and Discover remediation', () => {
    render(
      <BlogPostCard
        discoverReadiness="missing_featured_image"
        merchant={{ id: 'merchant-1', slug: 'demo' }}
        onDelete={vi.fn()}
        onPreview={vi.fn()}
        onStatusChange={vi.fn()}
        post={{
          author_name: 'Ada',
          category: 'Fashion',
          created_at: '2026-01-01T00:00:00Z',
          excerpt: 'A short post',
          featured_image_height: null,
          featured_image_url: 'https://example.com/image.jpg',
          featured_image_variants: null,
          featured_image_width: null,
          id: 'post-1',
          published_at: '2026-01-02T00:00:00Z',
          reading_time_minutes: 3,
          slug: 'summer-bags',
          status: 'published',
          title: 'Summer bags',
          updated_at: '2026-01-02T00:00:00Z',
          view_count: 42,
        }}
      />
    );

    expect(screen.getByText('Summer bags')).toBeInTheDocument();
    expect(screen.getByText('Needs featured image')).toBeInTheDocument();
    expect(screen.getByText('Fashion')).toBeInTheDocument();
    expect(screen.getByText('42 views')).toBeInTheDocument();
  });
});
