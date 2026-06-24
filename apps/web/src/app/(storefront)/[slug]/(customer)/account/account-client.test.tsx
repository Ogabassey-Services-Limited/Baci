import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountPageClient } from '@/app/(storefront)/[slug]/(customer)/account/account-client';
import type { Customer, CustomerUser } from '@/contexts/customer-auth-context';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useCurrency } from '@/hooks/use-currency';
import { useMerchant } from '@/hooks/use-merchant-client';

const push = vi.fn();

const defaultCustomer: Customer = {
  id: 'customer-1',
  first_name: 'Oga',
  last_name: 'Bassey',
  email: 'oga@example.com',
  total_orders: 4,
  total_spent: 100_000,
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
    currencySymbol: 'NGN',
  })),
}));

describe('AccountPageClient', () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(useCustomerAuth).mockReturnValue(createCustomerAuthValue());
    vi.mocked(useMerchant).mockReturnValue({
      merchant: { business_name: 'Ogabassey' },
      loading: false,
      basePath: '/ogabassey',
    } as ReturnType<typeof useMerchant>);
    vi.mocked(useCurrency).mockReturnValue({
      config: {
        code: 'NGN',
        locale: 'en-NG',
        name: 'Nigerian Naira',
        symbol: 'NGN',
      },
      countryCode: 'NG',
      currencyCode: 'NGN',
      currencySymbol: 'NGN',
      formatCurrency: (amount) => `NGN ${amount.toLocaleString()}`,
      formatCurrencyCompact: (amount) => `NGN ${amount.toLocaleString()}`,
    } as ReturnType<typeof useCurrency>);
  });

  it('renders a sign-in prompt for unauthenticated customers without redirecting', () => {
    vi.mocked(useCustomerAuth).mockReturnValue(
      createCustomerAuthValue({
        user: null,
        customer: null,
        isAuthenticated: false,
      })
    );

    render(<AccountPageClient />);

    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: /sign in to view your account/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /sign in to your account/i })
    ).toHaveAttribute('href', '/ogabassey/account/login');
  });

  it('shows account quick links for an authenticated customer', () => {
    render(<AccountPageClient />);

    expect(
      screen.getByRole('heading', { name: /welcome back, oga/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /receipts & invoices/i })
    ).toHaveAttribute('href', '/ogabassey/receipts');
  });
});
