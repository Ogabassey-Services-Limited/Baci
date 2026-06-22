import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CustomerAuthProvider,
  useCustomerAuth,
  useOptionalCustomerAuth,
} from '@/contexts/customer-auth-context';

vi.mock('@/hooks/use-cart', () => ({
  clearCartStorage: vi.fn(),
}));

function AuthProbe() {
  const { customer, isAuthenticated, isLoading } = useCustomerAuth();

  return (
    <p>
      {isLoading
        ? 'loading'
        : isAuthenticated
          ? `authenticated:${customer?.email}`
          : 'guest'}
    </p>
  );
}

function OptionalAuthProbe() {
  const auth = useOptionalCustomerAuth();

  return <p>{auth ? 'has-provider' : 'missing-provider'}</p>;
}

describe('CustomerAuthProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

    expect(
      await screen.findByText('authenticated:quiz@example.com')
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/storefront/auth/session?merchantSlug=ogabassey'
    );
  });

  it('renders a guest session when the customer is not authenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        authenticated: false,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomerAuthProvider merchantSlug="ogabassey">
        <AuthProbe />
      </CustomerAuthProvider>
    );

    expect(await screen.findByText('guest')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('allows optional consumers to render outside the customer auth provider', () => {
    render(<OptionalAuthProbe />);

    expect(screen.getByText('missing-provider')).toBeInTheDocument();
  });

  it('allows optional consumers to read the customer auth provider when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        authenticated: false,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomerAuthProvider merchantSlug="ogabassey">
        <OptionalAuthProbe />
      </CustomerAuthProvider>
    );

    expect(await screen.findByText('has-provider')).toBeInTheDocument();
  });

  it('clears stale customer state while hydrating a new merchant slug', async () => {
    let resolveSecondSession: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          authenticated: true,
          customer: {
            email: 'first@example.com',
            first_name: 'First',
            id: 'customer-1',
            last_name: 'Customer',
          },
          user: {
            email: 'first@example.com',
            id: 'user-1',
            role: 'customer',
          },
        })
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondSession = resolve;
          })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <CustomerAuthProvider merchantSlug="first-store">
        <AuthProbe />
      </CustomerAuthProvider>
    );

    expect(
      await screen.findByText('authenticated:first@example.com')
    ).toBeInTheDocument();

    rerender(
      <CustomerAuthProvider merchantSlug="second-store">
        <AuthProbe />
      </CustomerAuthProvider>
    );

    expect(await screen.findByText('loading')).toBeInTheDocument();
    expect(
      screen.queryByText('authenticated:first@example.com')
    ).not.toBeInTheDocument();

    resolveSecondSession(
      Response.json({
        authenticated: true,
        customer: {
          email: 'second@example.com',
          first_name: 'Second',
          id: 'customer-2',
          last_name: 'Customer',
        },
        user: {
          email: 'second@example.com',
          id: 'user-2',
          role: 'customer',
        },
      })
    );

    expect(
      await screen.findByText('authenticated:second@example.com')
    ).toBeInTheDocument();
  });

  it('renders a guest session when hydration fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error('session endpoint failed'));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomerAuthProvider merchantSlug="ogabassey">
        <AuthProbe />
      </CustomerAuthProvider>
    );

    expect(await screen.findByText('guest')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      'Session check error:',
      expect.any(Error)
    );
  });

  it('does not update state after the provider unmounts during hydration', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    let resolveSession: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveSession = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(
      <CustomerAuthProvider merchantSlug="ogabassey">
        <AuthProbe />
      </CustomerAuthProvider>
    );

    unmount();
    resolveSession(
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(consoleError).not.toHaveBeenCalled();
  });
});
