import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useParams: vi.fn(() => ({ orderId: 'order-1' })),
}));

vi.mock('next/link', () => ({
  default: vi.fn(
    ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  ),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: vi.fn(() => ({
    customer: { id: 'customer-1' },
    isAuthenticated: true,
    isLoading: false,
  })),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { slug: 'ogabassey' },
    loading: false,
    basePath: '/ogabassey',
  })),
}));

import CustomerOrderDetailsPage from './page';

function createJsonResponse(body: unknown): Response {
  const textBody = JSON.stringify(body);

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => textBody,
    clone() {
      return createJsonResponse(body);
    },
  } as Response;
}

describe('CustomerOrderDetailsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows an invoice CTA before the receipt is eligible', async () => {
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse({
        order: {
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
        },
      })
    );

    render(<CustomerOrderDetailsPage />);

    expect(
      await screen.findByRole('link', { name: /download invoice/i })
    ).toHaveAttribute(
      'href',
      '/api/storefront/account/orders/order-1/invoice?merchantSlug=ogabassey'
    );
  });

  it('shows a receipt CTA and uses the products route for buy again', async () => {
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse({
        order: {
          id: 'order-1',
          order_number: 'ORD-1001',
          created_at: '2026-03-22T10:00:00.000Z',
          shipping_status: 'shipped',
          payment_status: 'paid',
          payment_method: 'card',
          subtotal: 100000,
          total: 100000,
          shipping_fee: 0,
          currency: 'NGN',
          current_document_kind: 'receipt',
          receipt_eligible: true,
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
        },
      })
    );

    render(<CustomerOrderDetailsPage />);

    expect(
      await screen.findByRole('link', { name: /download receipt/i })
    ).toHaveAttribute(
      'href',
      '/api/storefront/account/orders/order-1/receipt?merchantSlug=ogabassey'
    );
    expect(
      await screen.findByRole('link', { name: /buy again/i })
    ).toHaveAttribute('href', '/ogabassey/products/prod-1');
  });
});
