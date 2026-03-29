import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: vi.fn((path: string) => path),
}));

vi.mock('@/lib/storefront-pagination', () => ({
  buildStorefrontPageHref: vi.fn(
    (basePath: string, page: number) =>
      page <= 1 ? basePath : `${basePath}?page=${page}`
  ),
}));

import { StorefrontPagination } from './StorefrontPagination';

describe('StorefrontPagination', () => {
  it('renders nothing when totalPages is 1', () => {
    const { container } = render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={1}
        totalPages={1}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when totalPages is 0', () => {
    const { container } = render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={1}
        totalPages={0}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders a navigation element with the default aria-label', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={1}
        totalPages={3}
      />
    );
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeDefined();
  });

  it('uses a custom aria-label when provided', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={1}
        totalPages={3}
        ariaLabel="Product pages"
      />
    );
    expect(
      screen.getByRole('navigation', { name: 'Product pages' })
    ).toBeDefined();
  });

  it('does not render Previous link on first page', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={1}
        totalPages={3}
      />
    );
    expect(screen.queryByText('Previous')).toBeNull();
    expect(screen.getByText('Next')).toBeDefined();
  });

  it('does not render Next link on last page', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={3}
        totalPages={3}
      />
    );
    expect(screen.getByText('Previous')).toBeDefined();
    expect(screen.queryByText('Next')).toBeNull();
  });

  it('renders both Previous and Next links on a middle page', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={2}
        totalPages={3}
      />
    );
    expect(screen.getByText('Previous')).toBeDefined();
    expect(screen.getByText('Next')).toBeDefined();
  });

  it('renders page number links', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={1}
        totalPages={3}
      />
    );
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('marks the current page with aria-current="page"', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={2}
        totalPages={3}
      />
    );
    const currentLink = screen.getByText('2');
    expect(currentLink.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('1').getAttribute('aria-current')).toBeNull();
  });

  it('generates correct hrefs for page links', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={2}
        totalPages={3}
      />
    );

    const page1Link = screen.getByText('1');
    expect(page1Link.getAttribute('href')).toBe('/store/products');

    const page3Link = screen.getByText('3');
    expect(page3Link.getAttribute('href')).toBe('/store/products?page=3');
  });

  it('generates correct href for Previous link', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={3}
        totalPages={5}
      />
    );
    const prevLink = screen.getByText('Previous').closest('a');
    expect(prevLink?.getAttribute('href')).toBe('/store/products?page=2');
  });

  it('generates correct href for Next link', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={2}
        totalPages={5}
      />
    );
    const nextLink = screen.getByText('Next').closest('a');
    expect(nextLink?.getAttribute('href')).toBe('/store/products?page=3');
  });

  it('shows ellipsis gaps for many pages', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={5}
        totalPages={10}
      />
    );

    // Should show pages 1, ...gap..., 4, 5, 6, ...gap..., 10
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('6')).toBeDefined();
    expect(screen.getByText('10')).toBeDefined();
    // Pages 2, 3, 7, 8, 9 should not be visible
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.queryByText('3')).toBeNull();
    expect(screen.queryByText('7')).toBeNull();
  });

  it('renders all pages when totalPages is 7 or fewer', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={4}
        totalPages={7}
      />
    );
    for (let i = 1; i <= 7; i++) {
      expect(screen.getByText(String(i))).toBeDefined();
    }
  });

  it('clamps invalid current pages to the first page', () => {
    render(
      <StorefrontPagination
        basePath="/store/products"
        currentPage={0}
        totalPages={5}
      />
    );

    expect(screen.getByText('1').getAttribute('aria-current')).toBe('page');
    expect(screen.queryByText('Previous')).toBeNull();
  });
});
