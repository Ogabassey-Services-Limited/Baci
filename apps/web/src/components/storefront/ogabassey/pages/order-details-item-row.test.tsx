import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderDetailsItemRow } from './order-details-item-row';

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    src: string;
  }) => <img alt={alt} src={src} />,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe('OrderDetailsItemRow', () => {
  it('renders a canonical product link when exact route data exists', () => {
    render(
      <OrderDetailsItemRow
        item={{
          id: 'item-1',
          product_id: 'product-1',
          product_slug: 'iphone-15-pro-max',
          categories: { slug: 'smartphones' },
          name: 'iPhone 15 Pro Max',
          product_name: 'iPhone 15 Pro Max',
          quantity: 1,
          price: 1000,
        }}
        basePath="/ogabassey"
      />
    );

    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/iphone-15-pro-max'
    );
  });

  it('renders a non-linked row when route data is missing', () => {
    render(
      <OrderDetailsItemRow
        item={{
          id: 'item-1',
          product_id: 'product-1',
          name: 'Wireless Headphones',
          product_name: 'Wireless Headphones',
          quantity: 2,
          price: 500,
        }}
        basePath="/ogabassey"
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
  });
});
