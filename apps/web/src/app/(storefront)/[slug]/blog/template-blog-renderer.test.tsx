import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TemplateBlogRenderer } from './template-blog-renderer';

describe('TemplateBlogRenderer', () => {
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
      <div data-testid="store-slug">{storeSlug}</div>
      <div data-testid="post-count">{posts?.length ?? 0}</div>
      <div data-testid="post-titles">
        {posts?.map((post) => post.title).join(',') ?? ''}
      </div>
      <div data-testid="categories">
        {categories?.map((category) => category.name).join(',') ?? ''}
      </div>
      <div data-testid="search-query">
        {searchQuery === undefined ? 'undefined' : searchQuery}
      </div>
    </div>
  );

  it('renders the template blog component with structured data scripts', () => {
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

    expect(screen.getByTestId('store-slug')).toHaveTextContent('/ogabassey');
    expect(screen.getByTestId('post-titles')).toHaveTextContent('First Post');
    expect(screen.getByTestId('categories')).toHaveTextContent('News');
    expect(screen.getByTestId('search-query')).toHaveTextContent('pixel');
    expect(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).toHaveLength(2);
  });

  it('renders no post entries when blogPosts is empty', () => {
    const { container } = render(
      <TemplateBlogRenderer
        blogSchema={{ '@type': 'Blog' }}
        breadcrumbSchema={{ '@type': 'BreadcrumbList' }}
        BlogComponent={BlogComponent}
        basePath="/ogabassey"
        blogPosts={[]}
        categories={[]}
      />
    );

    expect(screen.getByTestId('post-count')).toHaveTextContent('0');
    expect(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).toHaveLength(2);
  });

  it('passes an undefined search query through to the template component', () => {
    render(
      <TemplateBlogRenderer
        blogSchema={{ '@type': 'Blog' }}
        breadcrumbSchema={{ '@type': 'BreadcrumbList' }}
        BlogComponent={BlogComponent}
        basePath="/ogabassey"
        blogPosts={[]}
        categories={[{ name: 'News', slug: 'news' }]}
      />
    );

    expect(screen.getByTestId('search-query')).toHaveTextContent('undefined');
  });

  it('renders multiple posts and categories', () => {
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
          {
            id: 'post-2',
            title: 'Second Post',
            excerpt: 'Excerpt',
            category: 'Tips',
            author_name: 'Oga',
            published_at: '2026-03-30T00:00:00.000Z',
            featured_image_url: '',
            reading_time_minutes: 4,
            slug: 'second-post',
          },
        ]}
        categories={[
          { name: 'News', slug: 'news' },
          { name: 'Tips', slug: 'tips' },
        ]}
        searchQuery="launch"
      />
    );

    expect(screen.getByTestId('post-count')).toHaveTextContent('2');
    expect(screen.getByTestId('post-titles')).toHaveTextContent(
      'First Post,Second Post'
    );
    expect(screen.getByTestId('categories')).toHaveTextContent('News,Tips');
    expect(screen.getByTestId('search-query')).toHaveTextContent('launch');
    expect(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).toHaveLength(2);
  });
});
