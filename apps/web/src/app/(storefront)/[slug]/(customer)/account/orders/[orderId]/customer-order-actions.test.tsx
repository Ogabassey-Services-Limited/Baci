import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerOrderActions } from '@/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/customer-order-actions';
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

vi.mock(
  '@/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/cancel-order-dialog',
  () => ({
    CancelOrderDialog: ({ orderId }: { orderId: string }) => (
      <button type="button">Cancel Order {orderId}</button>
    ),
  })
);

const baseOrder: StorefrontOrder = {
  id: 'order-1',
  order_number: 'ORD-1001',
  created_at: '2026-03-22T10:00:00.000Z',
  shipping_status: 'processing',
  payment_status: 'unpaid',
  total: 100000,
  currency: 'NGN',
  current_document_kind: 'invoice',
  items: [],
};

function renderActions(orderOverrides: Partial<StorefrontOrder> = {}) {
  return render(
    <CustomerOrderActions
      order={{ ...baseOrder, ...orderOverrides }}
      documentLabel="Download Invoice"
      documentHref="/api/storefront/account/orders/order-1/invoice?merchantSlug=ogabassey"
      buyAgainHref={null}
    />
  );
}

describe('CustomerOrderActions', () => {
  it('renders the document download CTA', () => {
    renderActions();

    expect(
      screen.getByRole('link', { name: /download invoice/i })
    ).toHaveAttribute(
      'href',
      '/api/storefront/account/orders/order-1/invoice?merchantSlug=ogabassey'
    );
  });

  it('renders the cancel CTA only when the order is server-cancellable', () => {
    renderActions({ can_cancel: true });

    expect(
      screen.getByRole('button', { name: /cancel order/i })
    ).toBeInTheDocument();
  });

  it('hides the cancel CTA when the order is not cancellable', () => {
    renderActions({ can_cancel: false });

    expect(
      screen.queryByRole('button', { name: /cancel order/i })
    ).not.toBeInTheDocument();
  });
});
