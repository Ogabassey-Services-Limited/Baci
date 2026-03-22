import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerOrderDetailsContent } from '@/app/(storefront)/[slug]/account/orders/[orderId]/customer-order-details-content';
import type { StorefrontOrder } from '@/types/storefront-order';

vi.mock('next/link', () => ({
  default: vi.fn(
    ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  ),
}));

const baseOrder: StorefrontOrder = {
  id: 'order-1',
  order_number: 'ORD-1001',
  created_at: '2026-03-22T10:00:00.000Z',
  shipping_status: 'processing',
  payment_status: 'paid',
  payment_method: 'card',
  subtotal: 100000,
  total: 100000,
  shipping_fee: 0,
  currency: 'NGN',
  current_document_kind: 'invoice',
  items: [
    {
      id: 'item-1',
      product_id: 'prod-1',
      name: 'iPhone 16',
      product_name: 'iPhone 16',
      quantity: 1,
      price: 100000,
    },
  ],
  transactions: [],
};

describe('CustomerOrderDetailsContent', () => {
  it('renders the invoice CTA before the receipt is eligible', () => {
    render(
      <CustomerOrderDetailsContent
        order={baseOrder}
        basePath="/ogabassey"
        merchantSlug="ogabassey"
      />
    );

    expect(
      screen.getByRole('link', { name: /download invoice/i })
    ).toHaveAttribute(
      'href',
      '/api/storefront/account/orders/order-1/invoice?merchantSlug=ogabassey'
    );
    expect(
      screen.getByText(
        /receipts become available after the order has been shipped/i
      )
    ).toBeInTheDocument();
  });

  it('renders the receipt CTA and valid product routes once eligible', () => {
    render(
      <CustomerOrderDetailsContent
        order={{
          ...baseOrder,
          shipping_status: 'shipped',
          current_document_kind: 'receipt',
          receipt_eligible: true,
        }}
        basePath="/ogabassey"
        merchantSlug="ogabassey"
      />
    );

    expect(
      screen.getByRole('link', { name: /download receipt/i })
    ).toHaveAttribute(
      'href',
      '/api/storefront/account/orders/order-1/receipt?merchantSlug=ogabassey'
    );
    expect(
      screen.queryByRole('link', { name: /download invoice/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /receipts become available after the order has been shipped/i
      )
    ).not.toBeInTheDocument();
    expect(screen.getByText('Shipped')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /buy again/i })).toHaveAttribute(
      'href',
      '/ogabassey/products/prod-1'
    );
  });
});
