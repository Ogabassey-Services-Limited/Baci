import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

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
    customer: {
      first_name: 'Oga',
      email: 'oga@example.com',
      total_orders: 4,
      total_spent: 100000,
      store_credit: 0,
      saved_addresses: [],
    },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-merchant', () => ({
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

import { useCustomerAuth } from '@/contexts/customer-auth-context';
import AccountPage from './page';

describe('AccountPage', () => {
  it('includes a receipts and invoices quick link', () => {
    render(<AccountPage />);

    const link = screen.getByRole('link', { name: /receipts & invoices/i });
    expect(link).toHaveAttribute('href', '/ogabassey/receipts');
  });

  it('does not render customer-only links when the customer is unauthenticated', () => {
    vi.mocked(useCustomerAuth).mockReturnValue({
      customer: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    } as never);

    render(<AccountPage />);

    expect(
      screen.queryByRole('link', { name: /receipts & invoices/i })
    ).not.toBeInTheDocument();
  });

  it('shows a loading state while customer auth is loading', () => {
    vi.mocked(useCustomerAuth).mockReturnValue({
      customer: null,
      isAuthenticated: false,
      isLoading: true,
      logout: vi.fn(),
    } as never);

    render(<AccountPage />);

    expect(
      screen.getByRole('status', { name: /loading account/i })
    ).toBeInTheDocument();
  });
});
