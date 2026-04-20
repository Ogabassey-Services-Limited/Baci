import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutSuccessPage from '@/app/(storefront)/[slug]/(commerce)/checkout/success/page';

const mockPush = vi.fn();
const mockSearchParams = vi.fn();
const mockClearCart = vi.fn();
const mockFetch = vi.fn();

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

vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({
    basePath: '/test-store',
    merchant: { business_name: 'Test Store' },
  }),
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
});
