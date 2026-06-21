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

import { BlogListingPagination } from './blog-listing-pagination';

describe('BlogListingPagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <BlogListingPagination basePath="" currentPage={1} totalPages={1} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders crawlable prev/next/page links with correct hrefs', () => {
    render(
      <BlogListingPagination basePath="" currentPage={3} totalPages={36} />
    );

    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/blog?page=2'
    );
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/blog?page=4'
    );
    // Page 1 stays param-free to match the canonical /blog URL.
    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      '/blog'
    );
    expect(screen.getByRole('link', { name: '36' })).toHaveAttribute(
      'href',
      '/blog?page=36'
    );
    // Current page is marked, not a duplicate-priority link target.
    expect(screen.getByRole('link', { name: '3' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('omits Previous on the first page and Next on the last page', () => {
    const { rerender } = render(
      <BlogListingPagination basePath="" currentPage={1} totalPages={10} />
    );
    expect(screen.queryByRole('link', { name: 'Previous' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Next' })).toBeInTheDocument();

    rerender(
      <BlogListingPagination basePath="" currentPage={10} totalPages={10} />
    );
    expect(screen.getByRole('link', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
  });

  it('preserves the active category/search filter and the slug base path', () => {
    render(
      <BlogListingPagination
        basePath="/acme"
        currentPage={2}
        totalPages={5}
        category="phones"
        search="pixel"
      />
    );

    const next = screen.getByRole('link', { name: 'Next' });
    expect(next.getAttribute('href')).toContain('/acme/blog?');
    expect(next.getAttribute('href')).toContain('category=phones');
    expect(next.getAttribute('href')).toContain('search=pixel');
    expect(next.getAttribute('href')).toContain('page=3');
  });
});
