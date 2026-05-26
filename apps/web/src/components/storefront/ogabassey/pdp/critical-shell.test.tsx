import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyPdpCriticalShell } from './critical-shell';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority,
    src,
  }: {
    alt: string;
    fetchPriority?: string;
    src: string;
  }) => <img alt={alt} data-fetch-priority={fetchPriority} src={src} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('OgabasseyPdpCriticalShell', () => {
  it('renders one server-owned product heading and high-priority image', () => {
    render(
      <OgabasseyPdpCriticalShell
        basePath=""
        product={{
          brand: 'Lenovo',
          categoryName: 'Laptops',
          categorySlug: 'laptops',
          condition: 'used',
          id: 'product-1',
          image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
          name: 'Lenovo Legion Pro 9',
          price: 5_985_000,
          rating: 4.5,
          reviewCount: 12,
          slug: 'lenovo-legion-pro-9',
          stockQuantity: 3,
        }}
      >
        <button type="button">Add to Cart</button>
      </OgabasseyPdpCriticalShell>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Lenovo Legion Pro 9' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Lenovo Legion Pro 9' })
    ).toHaveAttribute('data-fetch-priority', 'high');
    expect(screen.getByRole('link', { name: 'Laptops' })).toHaveAttribute(
      'href',
      '/laptops'
    );
    expect(
      screen.getByRole('button', { name: 'Add to Cart' })
    ).toBeInTheDocument();
  });
});
