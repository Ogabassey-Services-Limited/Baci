import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TemplateBlogRenderer } from './template-blog-renderer';

describe('TemplateBlogRenderer', () => {
  it('renders the template blog component with structured data scripts', () => {
    const BlogComponent = ({
      storeSlug,
      posts,
      categories,
      searchQuery,
    }: {
      storeSlug?: string;
      posts?: Array<{ title: string }>;
      categories?: Array<{ name: string }>;
      searchQuery?: string;
    }) => (
      <div>
        {storeSlug}::{posts?.[0]?.title}::
        {categories?.map((category) => category.name).join(',')}::{searchQuery}
      </div>
    );

    const { container } = render(
      <TemplateBlogRenderer
        blogSchema={{ '@type': 'Blog' }}
        breadcrumbSchema={{ '@type': 'BreadcrumbList' }}
        BlogComponent={BlogComponent}
        basePath="/ogabassey"
        blogPosts={[
          {
            id: 'post-1',
            title: 'First Post',
            excerpt: 'Excerpt',
            category: 'News',
            author_name: 'Oga',
            published_at: '2026-03-29T00:00:00.000Z',
            featured_image_url: '',
            reading_time_minutes: 3,
            slug: 'first-post',
          },
        ]}
        categories={[{ name: 'News', slug: 'news' }]}
        searchQuery="pixel"
      />
    );

    expect(
      screen.getByText('/ogabassey::First Post::News::pixel')
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).toHaveLength(2);
  });
});
