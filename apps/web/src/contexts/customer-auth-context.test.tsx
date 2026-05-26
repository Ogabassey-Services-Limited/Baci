import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CustomerAuthProvider,
  useCustomerAuth,
} from '@/contexts/customer-auth-context';

vi.mock('@/hooks/use-cart', () => ({
  clearCartStorage: vi.fn(),
}));

function AuthProbe() {
  const { isAuthenticated, isLoading } = useCustomerAuth();

  return (
    <p>{isLoading ? 'loading' : isAuthenticated ? 'authenticated' : 'guest'}</p>
  );
}

describe('CustomerAuthProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('checks the storefront customer session once on initial auth hydration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        authenticated: true,
        customer: {
          email: 'quiz@example.com',
          first_name: 'Quiz',
          id: 'customer-1',
          last_name: 'Tester',
        },
        user: {
          email: 'quiz@example.com',
          id: 'user-1',
          role: 'customer',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomerAuthProvider merchantSlug="ogabassey">
        <AuthProbe />
      </CustomerAuthProvider>
    );

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/storefront/auth/session?merchantSlug=ogabassey'
    );
  });
});
