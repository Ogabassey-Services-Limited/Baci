import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogDiscoverySection } from '@/app/(storefront)/[slug]/(blog)/blog/blog-discovery-section';

describe('BlogDiscoverySection', () => {
  it('links to product, home, category, and article discovery targets', () => {
    render(
      <BlogDiscoverySection
        baseUrl="https://store.example"
        categories={['Phones']}
        posts={[{ id: 'post-1', title: 'Buying guide', slug: 'buying-guide' }]}
      />
    );

    expect(screen.getByRole('link', { name: 'All Products' })).toHaveAttribute(
      'href',
      'https://store.example/products'
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      'https://store.example/'
    );
    expect(screen.getByRole('link', { name: 'Phones' })).toHaveAttribute(
      'href',
      'https://store.example/blog?category=Phones'
    );
    expect(screen.getByRole('link', { name: 'Buying guide' })).toHaveAttribute(
      'href',
      'https://store.example/blog/buying-guide'
    );
  });

  it('encodes discovery URLs and caps generated category and post links', () => {
    render(
      <BlogDiscoverySection
        baseUrl="https://store.example"
        categories={Array.from({ length: 13 }, (_, index) =>
          index === 0 ? 'Cases & Covers' : `Category ${index}`
        )}
        posts={Array.from({ length: 25 }, (_, index) => ({
          id: `post-${index}`,
          title: index === 0 ? 'Buying guide' : `Post ${index}`,
          slug: index === 0 ? 'buying guide/2026' : `post-${index}`,
        }))}
      />
    );

    expect(
      screen.getByRole('link', { name: 'Cases & Covers' })
    ).toHaveAttribute(
      'href',
      'https://store.example/blog?category=Cases%20%26%20Covers'
    );
    expect(screen.queryByRole('link', { name: 'Category 12' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Buying guide' })).toHaveAttribute(
      'href',
      'https://store.example/blog/buying%20guide%2F2026'
    );
    expect(screen.queryByRole('link', { name: 'Post 24' })).toBeNull();
  });

  it('omits article discovery links when no posts are available', () => {
    render(
      <BlogDiscoverySection
        baseUrl="https://store.example"
        categories={[]}
        posts={[]}
      />
    );

    expect(
      screen.queryByRole('heading', { name: 'Latest Article Links' })
    ).toBeNull();
  });
});
