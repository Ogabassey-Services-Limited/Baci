import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BlogRelatedProducts } from './BlogRelatedProducts';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

describe('BlogRelatedProducts', () => {
  it('renders a live price and unavailable state for managed stock', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        currencySource={{ country: 'NG', payout_currency: 'NGN' }}
        products={[
          {
            category_slug: 'smartphones',
            id: 'product-1',
            name: 'iPhone 16',
            price: 150000,
            manage_stock: true,
            stock: 0,
            slug: 'iphone-16',
          },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: /iphone 16/i })).toHaveTextContent(
      '₦150,000'
    );
    expect(screen.getByText('Currently unavailable')).toBeInTheDocument();
  });

  it('keeps the product link when optional live fields are absent', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        products={[
          {
            id: 'product-2',
            name: 'USB-C cable',
            slug: 'usb-c-cable',
          },
        ]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'USB-C cable' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Currently unavailable')).not.toBeInTheDocument();
  });
});
