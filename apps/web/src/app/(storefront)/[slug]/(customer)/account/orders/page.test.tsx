import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerOrdersPage from '@/app/(storefront)/[slug]/(customer)/account/orders/page';
import type { Customer, CustomerUser } from '@/contexts/customer-auth-context';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant';

const push = vi.fn();
const defaultCustomer: Customer = {
  id: 'customer-1',
  first_name: 'Oga',
  last_name: 'Bassey',
  email: 'oga@example.com',
  saved_addresses: [],
};
const defaultUser: CustomerUser = {
  id: 'user-1',
  email: 'oga@example.com',
  role: 'customer',
};

function createCustomerAuthValue(
  overrides: Partial<ReturnType<typeof useCustomerAuth>> = {}
): ReturnType<typeof useCustomerAuth> {
  return {
    user: defaultUser,
    customer: defaultCustomer,
    isAuthenticated: true,
    isLoading: false,
    otpState: null,
    sendOtp: vi.fn(async () => ({ success: true })),
    verifyOtp: vi.fn(async () => ({ success: true })),
    signInWithGoogle: vi.fn(async () => ({ success: true })),
    signInWithApple: vi.fn(async () => ({ success: true })),
    logout: vi.fn(async () => undefined),
    refreshCustomer: vi.fn(async () => undefined),
    updateCustomer: vi.fn(async () => ({ success: true })),
    ...overrides,
  };
}

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push })),
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
  useCustomerAuth: vi.fn(() => createCustomerAuthValue()),
}));

vi.mock('@/hooks/use-merchant', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { slug: 'ogabassey' },
    loading: false,
    basePath: '/ogabassey',
  })),
}));

vi.mock('@/components/storefront/ogabassey/pages/purchase-history', () => ({
  OgabasseyV2PurchaseHistory: vi.fn(
    ({ orders }: { orders: { order_number: string }[] }) => (
      <div>
        <h2>Purchase history</h2>
        {orders.map((order) => (
          <p key={order.order_number}>{order.order_number}</p>
        ))}
      </div>
    )
  ),
}));

function createJsonResponse(body: unknown, status = 200): Response {
  const textBody = JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => textBody,
    clone() {
      return createJsonResponse(body, status);
    },
  } as Response;
}

describe('CustomerOrdersPage', () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(useCustomerAuth).mockReturnValue(createCustomerAuthValue());
    vi.mocked(useMerchant).mockReturnValue({
      merchant: { slug: 'ogabassey' },
      loading: false,
      basePath: '/ogabassey',
    } as ReturnType<typeof useMerchant>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to login', async () => {
    vi.mocked(useCustomerAuth).mockReturnValue(
      createCustomerAuthValue({
        user: null,
        customer: null,
        isAuthenticated: false,
        isLoading: false,
      })
    );

    render(<CustomerOrdersPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/ogabassey/account/login?redirect=%2Fogabassey%2Faccount%2Forders'
      );
    });
  });

  it('renders fetched orders in the purchase history view', async () => {
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse({
        orders: [
          {
            id: 'order-1',
            order_number: 'ORD-1001',
            created_at: '2026-03-22T10:00:00.000Z',
            total: 10000,
            payment_status: 'paid',
            shipping_status: 'processing',
            items: [],
          },
        ],
      })
    );

    render(<CustomerOrdersPage />);

    expect(await screen.findByText('Purchase history')).toBeInTheDocument();
    expect(screen.getByText('ORD-1001')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/storefront/orders?merchantSlug=ogabassey'
    );
  });

  it('shows a retryable error state when fetching orders fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse({ error: 'Failed to load orders' }, 500)
      )
      .mockResolvedValueOnce(createJsonResponse({ orders: [] }));

    render(<CustomerOrdersPage />);

    expect(
      await screen.findByText(/unable to load orders/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the merchant unavailable state when the storefront is missing', () => {
    vi.mocked(useMerchant).mockReturnValue({
      merchant: null,
      loading: false,
      basePath: '/ogabassey',
    } as ReturnType<typeof useMerchant>);

    render(<CustomerOrdersPage />);

    expect(screen.getByText(/store unavailable/i)).toBeInTheDocument();
  });

  it('shows a loading state while merchant context is still resolving', () => {
    vi.mocked(useMerchant).mockReturnValue({
      merchant: null,
      loading: true,
      basePath: '/ogabassey',
    } as ReturnType<typeof useMerchant>);

    render(<CustomerOrdersPage />);

    expect(screen.getByText(/loading orders/i)).toBeInTheDocument();
  });
});
