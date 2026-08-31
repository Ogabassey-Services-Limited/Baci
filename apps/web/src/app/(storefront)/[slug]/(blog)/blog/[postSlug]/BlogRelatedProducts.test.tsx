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

  it('uses current stock when legacy stock is stale', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        products={[
          {
            id: 'product-3',
            name: 'USB-C charger',
            price: 20000,
            manage_stock: true,
            stock: 0,
            stock_quantity: 4,
            slug: 'usb-c-charger',
          },
        ]}
      />
    );

    expect(screen.queryByText('Currently unavailable')).not.toBeInTheDocument();
  });

  it('treats null managed-stock values as managed when effective stock is zero', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        products={[
          {
            id: 'product-null-managed-stock',
            name: 'Legacy phone',
            manage_stock: null,
            stock: 0,
            slug: 'legacy-phone',
          },
        ]}
      />
    );

    expect(screen.getByText('Currently unavailable')).toBeInTheDocument();
  });

  it('does not show unavailable when a stocked condition offer can be purchased', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        products={[
          {
            id: 'product-4',
            name: 'iPhone 16 Used',
            slug: 'iphone-16-used',
            manage_stock: true,
            stock: 0,
            has_condition_offers: true,
            has_purchasable_condition_offer: true,
          },
        ]}
      />
    );

    expect(screen.queryByText('Currently unavailable')).not.toBeInTheDocument();
  });

  it('does not show unavailable when a stocked product variant can be purchased', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        products={[
          {
            id: 'product-5',
            name: 'iPad 10 Wi-Fi + Cellular',
            slug: 'ipad-10',
            manage_stock: true,
            stock: 0,
            has_variants: true,
            has_purchasable_variant: true,
          },
        ]}
      />
    );

    expect(screen.queryByText('Currently unavailable')).not.toBeInTheDocument();
  });

  it('renders the purchasable variant price instead of the stale parent price', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        currencySource={{ country: 'NG', payout_currency: 'NGN' }}
        products={[
          {
            id: 'product-6',
            name: 'iPad 10 Wi-Fi + Cellular',
            price: 150000,
            manage_stock: true,
            stock: 0,
            has_variants: true,
            variants: [{ price_override: 175000, stock_quantity: 2 }],
            slug: 'ipad-10',
          },
        ]}
      />
    );

    const link = screen.getByRole('link', {
      name: /ipad 10 wi-fi \+ cellular/i,
    });
    expect(link).toHaveTextContent('₦175,000');
    expect(link).not.toHaveTextContent('₦150,000');
  });

  it('renders the purchasable condition-offer price instead of the parent price', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        currencySource={{ country: 'NG', payout_currency: 'NGN' }}
        products={[
          {
            id: 'product-7',
            name: 'iPhone 16 Used',
            price: 150000,
            manage_stock: true,
            stock: 0,
            has_condition_offers: true,
            has_purchasable_condition_offer: true,
            offers: [{ price: 125000, stock_quantity: 1 }],
            slug: 'iphone-16-used',
          },
        ]}
      />
    );

    const link = screen.getByRole('link', {
      name: /iphone 16 used/i,
    });
    expect(link).toHaveTextContent('₦125,000');
    expect(link).not.toHaveTextContent('₦150,000');
  });

  it('does not advertise an out-of-stock nullable parent price beside a stocked child', () => {
    render(
      <BlogRelatedProducts
        basePath="/ogabassey"
        currencySource={{ country: 'NG', payout_currency: 'NGN' }}
        products={[
          {
            id: 'product-null-parent',
            name: 'iPad 10',
            price: 150000,
            manage_stock: null,
            stock: 0,
            variants: [{ price_override: 175000, stock_quantity: 2 }],
            slug: 'ipad-10',
          },
        ]}
      />
    );

    const link = screen.getByRole('link', { name: /iPad 10/i });
    expect(link).toHaveTextContent('₦175,000');
    expect(link).not.toHaveTextContent('₦150,000');
  });
});
