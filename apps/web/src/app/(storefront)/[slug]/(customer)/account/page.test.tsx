import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountPage, {
  metadata,
} from '@/app/(storefront)/[slug]/(customer)/account/page';
import type { Customer, CustomerUser } from '@/contexts/customer-auth-context';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant-client';
import { getStorefrontAccountInitialCustomer } from '@/lib/storefront-account-initial-session';

const push = vi.fn();
const defaultCustomer: Customer = {
  id: 'customer-1',
  first_name: 'Oga',
  last_name: 'Bassey',
  email: 'oga@example.com',
  total_orders: 4,
  total_spent: 100000,
  store_credit: 0,
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

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { business_name: 'Ogabassey' },
    loading: false,
    basePath: '/ogabassey',
  })),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: vi.fn(() => ({
    currencySymbol: '₦',
  })),
}));

vi.mock('@/lib/storefront-account-initial-session', () => ({
  getStorefrontAccountInitialCustomer: vi.fn(() => Promise.resolve(null)),
}));

describe('AccountPage', () => {
  it('opts the account page out of indexing and following links', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  beforeEach(() => {
    push.mockReset();
    vi.mocked(useCustomerAuth).mockReturnValue(createCustomerAuthValue());
    vi.mocked(getStorefrontAccountInitialCustomer).mockResolvedValue(null);
    vi.mocked(useMerchant).mockReturnValue({
      merchant: { business_name: 'Ogabassey' },
      loading: false,
      basePath: '/ogabassey',
    } as ReturnType<typeof useMerchant>);
  });

  it('includes a receipts and invoices quick link', async () => {
    render(
      await AccountPage({ params: Promise.resolve({ slug: 'ogabassey' }) })
    );

    const link = screen.getByRole('link', { name: /receipts & invoices/i });
    expect(link).toHaveAttribute('href', '/ogabassey/receipts');
  });

  it('does not redirect while auth or merchant data is still loading', async () => {
    vi.mocked(useCustomerAuth).mockReturnValue(
      createCustomerAuthValue({
        user: null,
        customer: null,
        isAuthenticated: false,
        isLoading: true,
      })
    );
    vi.mocked(useMerchant).mockReturnValue({
      merchant: null,
      loading: true,
      basePath: '/ogabassey',
    } as ReturnType<typeof useMerchant>);

    render(
      await AccountPage({ params: Promise.resolve({ slug: 'ogabassey' }) })
    );

    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole('status', { name: /loading account/i })
    ).toBeInTheDocument();
  });

  it('renders a sign-in prompt for unauthenticated users without a client redirect', async () => {
    vi.mocked(useCustomerAuth).mockReturnValue(
      createCustomerAuthValue({
        user: null,
        customer: null,
        isAuthenticated: false,
        isLoading: false,
      })
    );

    render(
      await AccountPage({ params: Promise.resolve({ slug: 'ogabassey' }) })
    );

    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: /sign in to view your account/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /sign in to your account/i })
    ).toHaveAttribute(
      'href',
      '/ogabassey/account/login?redirect=%2Fogabassey%2Faccount'
    );
  });

  it('renders the sign-in prompt while only customer auth is loading', async () => {
    vi.mocked(useCustomerAuth).mockReturnValue(
      createCustomerAuthValue({
        user: null,
        customer: null,
        isAuthenticated: false,
        isLoading: true,
      })
    );

    render(
      await AccountPage({ params: Promise.resolve({ slug: 'ogabassey' }) })
    );

    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: /sign in to view your account/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: /loading account/i })
    ).not.toBeInTheDocument();
  });
  it('uses the server initial customer while client auth hydration is pending', async () => {
    vi.mocked(getStorefrontAccountInitialCustomer).mockResolvedValue(
      defaultCustomer
    );
    vi.mocked(useCustomerAuth).mockReturnValue(
      createCustomerAuthValue({
        user: null,
        customer: null,
        isAuthenticated: false,
        isLoading: true,
      })
    );

    render(
      await AccountPage({ params: Promise.resolve({ slug: 'ogabassey' }) })
    );

    expect(getStorefrontAccountInitialCustomer).toHaveBeenCalledWith(
      'ogabassey'
    );
    expect(
      screen.getByRole('heading', { name: /welcome back, oga/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /sign in to view your account/i })
    ).not.toBeInTheDocument();
  });
});
