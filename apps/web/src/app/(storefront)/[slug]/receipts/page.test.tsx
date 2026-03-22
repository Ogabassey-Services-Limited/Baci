import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReceiptsPage from '@/app/(storefront)/[slug]/receipts/page';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
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

describe('ReceiptsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows only shipped and delivered orders in the archive', async () => {
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse({
        orders: [
          {
            id: 'order-processing',
            order_number: 'ORD-1000',
            created_at: '2026-03-21T10:00:00.000Z',
            total: 10000,
            currency: 'NGN',
            shipping_status: 'processing',
            current_document_kind: 'invoice',
            items: [
              {
                id: 'item-1',
                name: 'Pending Item',
                quantity: 1,
                price: 10000,
              },
            ],
          },
          {
            id: 'order-shipped',
            order_number: 'ORD-1001',
            created_at: '2026-03-22T10:00:00.000Z',
            total: 20000,
            currency: 'NGN',
            shipping_status: 'shipped',
            current_document_kind: 'invoice',
            items: [
              {
                id: 'item-2',
                name: 'Shipped Item',
                quantity: 1,
                price: 20000,
              },
            ],
          },
          {
            id: 'order-delivered',
            order_number: 'ORD-1002',
            created_at: '2026-03-23T10:00:00.000Z',
            total: 30000,
            currency: 'NGN',
            shipping_status: 'delivered',
            current_document_kind: 'receipt',
            items: [
              {
                id: 'item-3',
                name: 'Delivered Item',
                quantity: 1,
                price: 30000,
              },
            ],
          },
        ],
      })
    );

    render(<ReceiptsPage />);

    expect(await screen.findByText('#ORD-1001')).toBeInTheDocument();
    expect(screen.getByText('#ORD-1002')).toBeInTheDocument();
    expect(screen.queryByText('#ORD-1000')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /download invoice/i })
    ).toHaveAttribute(
      'href',
      '/api/storefront/account/orders/order-shipped/invoice?merchantSlug=ogabassey'
    );
    expect(
      screen.getByRole('link', { name: /download receipt/i })
    ).toHaveAttribute(
      'href',
      '/api/storefront/account/orders/order-delivered/receipt?merchantSlug=ogabassey'
    );
  });
});
