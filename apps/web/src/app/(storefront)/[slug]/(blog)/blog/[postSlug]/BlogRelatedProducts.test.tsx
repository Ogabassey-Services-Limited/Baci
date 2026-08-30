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
  it('renders the current catalog price beside each linked product', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        countryCode="NG"
        payoutCurrency="NGN"
        products={[
          {
            id: 'product-1',
            name: 'Pixel 11',
            slug: 'pixel-11',
            category_slug: 'smartphones',
            price: 950000,
            compare_at_price: 1000000,
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', { name: /popular products/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pixel 11' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/pixel-11'
    );
    expect(screen.getByText('₦950,000.00')).toBeInTheDocument();
    expect(screen.getByText('₦1,000,000.00')).toBeInTheDocument();
    expect(screen.getByText('Original price:')).toBeInTheDocument();
    expect(
      screen.getByText(/prices below come from the live catalog/i)
    ).toBeInTheDocument();
  });

  it('keeps the product link when the catalog has no price', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        products={[
          {
            id: 'product-2',
            name: 'Unpriced accessory',
            slug: 'unpriced-accessory',
            category_slug: null,
          },
        ]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'Unpriced accessory' })
    ).toHaveAttribute('href', '/ogabassey/products/unpriced-accessory');
    expect(screen.queryByText(/current price/i)).not.toBeInTheDocument();
  });

  it('uses the merchant payout currency when it differs from country', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        countryCode="NG"
        payoutCurrency="USD"
        products={[
          {
            id: 'product-3',
            name: 'International accessory',
            slug: 'international-accessory',
            category_slug: 'accessories',
            price: 100,
          },
        ]}
      />
    );

    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });
});
