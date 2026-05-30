import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutSuccessPage from '@/app/(storefront)/[slug]/(commerce)/checkout/success/page';

const mockPush = vi.fn();
const mockSearchParams = vi.fn();
const mockClearCart = vi.fn();
const mockFetch = vi.fn();
const mockUseMerchantSafe = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        ({
          children,
          ...props
        }: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) =>
          React.createElement(tag, props, children),
    }
  ),
}));

vi.mock('@/hooks/cart', () => ({
  useCart: () => ({
    clearCart: mockClearCart,
  }),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => mockUseMerchantSafe(),
}));

vi.mock(
  '@/components/storefront/ogabassey/pages/checkout/pending-checkout-order',
  () => ({
    CHECKOUT_PENDING_ORDER_STORAGE_KEY: 'pending-order',
  })
);

vi.mock('@/components/storefront/ogabassey/components/AdUnit', () => ({
  AdUnit: () => <div data-testid="ad-unit" />,
}));

describe('checkout success page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        reference: 'txn-ref-123',
      })
    );
    mockUseMerchantSafe.mockReturnValue({
      basePath: '/test-store',
      merchant: { business_name: 'Test Store', slug: 'test-store' },
    });
    mockFetch.mockReturnValue(new Promise(() => undefined));
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('does not let the standalone verifying screen own the first paint', () => {
    render(<CheckoutSuccessPage />);

    expect(
      screen.getByRole('heading', { name: /order being processed/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/verifying your payment/i)).toBeNull();
  });

  it('links support users to the canonical contact route', () => {
    render(<CheckoutSuccessPage />);

    expect(
      screen.getByRole('link', { name: /contact our support team/i })
    ).toHaveAttribute('href', '/test-store/contact');
  });

  it('fetches invoice order details with merchant slug and tracking token', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-123',
        trackingToken: 'track-token-123',
        type: 'invoice',
      })
    );
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        order_number: 'ORD-1001',
        payment_method: 'invoice',
      }),
    });

    render(<CheckoutSuccessPage />);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/storefront/orders/order-123?merchant_slug=test-store&tracking_token=track-token-123'
      )
    );
    expect(mockClearCart).toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: /invoice generated/i })
    ).toBeInTheDocument();
  });

  it('does not send a literal undefined slug when merchant context has no slug', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'order-123',
      })
    );
    mockUseMerchantSafe.mockReturnValue({
      basePath: '/test-store',
      merchant: { business_name: 'Test Store' },
    });
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<CheckoutSuccessPage />);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/storefront/orders/order-123')
    );
    expect(mockFetch.mock.calls[0]?.[0]).not.toContain('undefined');
  });

  it('falls back to a derived order number when order lookup rejects', async () => {
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        orderId: 'abcdefgh-1234',
      })
    );
    mockFetch.mockRejectedValue(new Error('network failed'));

    render(<CheckoutSuccessPage />);

    expect(
      await screen.findByRole('heading', { name: /order received/i })
    ).toBeInTheDocument();
    expect(mockClearCart).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText('#ABCDEFGH')).toBeInTheDocument()
    );
  });
});
