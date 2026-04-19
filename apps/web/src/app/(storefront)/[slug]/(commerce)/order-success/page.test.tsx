import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderSuccessPage from '@/app/(storefront)/[slug]/(commerce)/order-success/page';

const mockSearchParams = vi.fn();
const mockFetch = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    basePath: '/test-store',
    merchant: { slug: 'test-store' },
  }),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuthSafe: () => ({
    user: null,
  }),
}));

vi.mock('@/components/analytics/google-customer-reviews', () => ({
  GoogleCustomerReviews: () => null,
}));

describe('storefront order success page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-123',
        trackingToken: 'track-token-123',
      })
    );
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'order-123',
        order_number: 'ORD-123',
        tracking_token: 'track-token-123',
        customer_email: 'buyer@example.com',
        items: [],
        subtotal: 3500,
        shipping_cost: 0,
        total: 3500,
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('does not let a full-page loading state own the first paint while order details are pending', () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));

    render(<OrderSuccessPage />);

    expect(
      screen.getByRole('heading', { name: /order confirmed!/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/loading order details/i)).toBeNull();
  });

  it('uses trackingToken to fetch guest order details', async () => {
    render(<OrderSuccessPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-123?merchant_slug=test-store&token=track-token-123'
      );
    });

    expect(
      await screen.findByRole('link', { name: /track my order/i })
    ).toHaveAttribute('href', '/test-store/track-order?token=track-token-123');
  });

  it('keeps supporting legacy token query params', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-123',
        token: 'legacy-token-123',
      })
    );

    render(<OrderSuccessPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-123?merchant_slug=test-store&token=legacy-token-123'
      );
    });
  });
});
