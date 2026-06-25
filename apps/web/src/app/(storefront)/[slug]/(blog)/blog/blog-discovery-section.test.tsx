import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BlogDiscoverySection } from '@/app/(storefront)/[slug]/(blog)/blog/blog-discovery-section';

describe('BlogDiscoverySection', () => {
  it('links to product, home, category, and article discovery targets', () => {
    render(
      <BlogDiscoverySection
        baseUrl="https://store.example"
        authors={[{ name: 'Bassey John', slug: 'bassey-john' }]}
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
      'https://store.example/blog/category/phones'
    );
    expect(screen.getByRole('link', { name: 'Buying guide' })).toHaveAttribute(
      'href',
      'https://store.example/blog/buying-guide'
    );
    expect(screen.getByRole('link', { name: 'Bassey John' })).toHaveAttribute(
      'href',
      'https://store.example/blog/author/bassey-john'
    );
  });

  it('encodes discovery URLs and caps generated category and post links', () => {
    render(
      <BlogDiscoverySection
        baseUrl="https://store.example"
        authors={[]}
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
      'https://store.example/blog/category/cases-covers'
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
        authors={[]}
        categories={[]}
        posts={[]}
      />
    );

    expect(
      screen.queryByRole('heading', { name: 'Latest Article Links' })
    ).toBeNull();
  });

  it('keeps ambiguous category slugs on absolute query links', () => {
    render(
      <BlogDiscoverySection
        baseUrl="https://store.example"
        categories={['Cases & Covers', 'Cases Covers']}
        posts={[]}
      />
    );

    expect(screen.getByRole('link', { name: 'Cases Covers' })).toHaveAttribute(
      'href',
      'https://store.example/blog?category=Cases+Covers'
    );
  });
});
