import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletFundingPanel } from './WalletFundingPanel';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());
const mockCaptureClientEvent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: mockToast,
}));

vi.mock('@/lib/posthog/capture-client-event', () => ({
  captureClientEvent: mockCaptureClientEvent,
}));

function capturedEvents(name: string) {
  return mockCaptureClientEvent.mock.calls.filter(([event]) => event === name);
}

const account = {
  accountName: 'OGB / JOHN DOE',
  accountNumber: '9012345678',
  bankName: 'Wema Bank',
  provider: 'paystack',
};

describe('WalletFundingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the funding account with the DVA fee note when one exists', () => {
    render(
      <WalletFundingPanel
        account={account}
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={vi.fn()}
        requiresConsent={false}
      />
    );

    expect(screen.getByText('9012345678')).toBeInTheDocument();
    expect(screen.getByText('Wema Bank')).toBeInTheDocument();
    expect(screen.getByText('OGB / JOHN DOE')).toBeInTheDocument();
    expect(
      screen.getByText(/1% \(capped at ₦300\)/i)
    ).toBeInTheDocument();
  });

  it('copies the account number to the clipboard', async () => {
    // userEvent.setup() installs a working clipboard stub in jsdom.
    const user = userEvent.setup();

    render(
      <WalletFundingPanel
        account={account}
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={vi.fn()}
        requiresConsent={false}
      />
    );

    await user.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Account number copied',
      });
    });
    await expect(navigator.clipboard.readText()).resolves.toBe('9012345678');
  });

  it('invokes onRefreshBalance from the refresh CTA', async () => {
    const user = userEvent.setup();
    const onRefreshBalance = vi.fn();

    render(
      <WalletFundingPanel
        account={account}
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={vi.fn()}
        onRefreshBalance={onRefreshBalance}
        requiresConsent={false}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /refresh balance/i })
    );

    expect(onRefreshBalance).toHaveBeenCalledOnce();
  });

  it('creates a funding account after consent', async () => {
    const user = userEvent.setup();
    const onAccountCreated = vi.fn();
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({ account, requiresConsent: false }),
    });

    render(
      <WalletFundingPanel
        account={null}
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={onAccountCreated}
        requiresConsent={true}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /get my account number/i })
    );

    await waitFor(() => {
      expect(onAccountCreated).toHaveBeenCalledWith(account);
    });
    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/storefront/customer/wallet/funding-account',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ consent: true, merchantSlug: 'ogabassey' }),
      })
    );
    expect(capturedEvents('wallet_funding_account_create_attempted')).toEqual([
      [
        'wallet_funding_account_create_attempted',
        expect.objectContaining({
          surface: 'utility_modal',
          merchant_slug: 'ogabassey',
        }),
      ],
    ]);
    expect(capturedEvents('wallet_funding_account_created')).toEqual([
      [
        'wallet_funding_account_created',
        expect.objectContaining({
          surface: 'utility_modal',
          provider: 'paystack',
          merchant_slug: 'ogabassey',
        }),
      ],
    ]);
  });

  it('creates the account automatically when opened via Pay with Bank Transfer', async () => {
    const onAccountCreated = vi.fn();
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({ account, requiresConsent: false }),
    });

    render(
      <WalletFundingPanel
        account={null}
        autoCreate
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={onAccountCreated}
        requiresConsent={true}
      />
    );

    await waitFor(() => {
      expect(onAccountCreated).toHaveBeenCalledWith(account);
    });
    expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1);
  });

  it('does not auto-create when an account already exists', () => {
    render(
      <WalletFundingPanel
        account={account}
        autoCreate
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={vi.fn()}
        requiresConsent={false}
      />
    );

    expect(mockFetchWithCsrf).not.toHaveBeenCalled();
  });

  it('maps the order-reservation conflict to actionable retry copy', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'This Paystack account is still reserved for an active order payment',
        code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
      }),
    });

    render(
      <WalletFundingPanel
        account={null}
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={vi.fn()}
        requiresConsent={true}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /get my account number/i })
    );

    expect(
      await screen.findByText(/handling an order payment right now/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/still reserved for an active order payment/i)
    ).not.toBeInTheDocument();
    expect(capturedEvents('wallet_funding_account_create_failed')).toEqual([
      [
        'wallet_funding_account_create_failed',
        expect.objectContaining({
          surface: 'utility_modal',
          reason: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
        }),
      ],
    ]);
  });

  it('surfaces the API error when account creation fails', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Wallet bank transfer funding is not enabled',
        code: 'WALLET_DVA_DISABLED',
      }),
    });

    render(
      <WalletFundingPanel
        account={null}
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={vi.fn()}
        requiresConsent={true}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /get my account number/i })
    );

    expect(
      await screen.findByText(/bank transfer funding is not enabled/i)
    ).toBeInTheDocument();
    expect(capturedEvents('wallet_funding_account_create_failed')).toEqual([
      [
        'wallet_funding_account_create_failed',
        expect.objectContaining({
          surface: 'utility_modal',
          reason: 'WALLET_DVA_DISABLED',
        }),
      ],
    ]);
  });

  it('shows an unavailable message when there is no account and no consent path', () => {
    render(
      <WalletFundingPanel
        account={null}
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={vi.fn()}
        requiresConsent={false}
      />
    );

    expect(
      screen.getByText(/not available right now/i)
    ).toBeInTheDocument();
  });

  it('reports the funnel-entry event once on mount with surface context', () => {
    render(
      <WalletFundingPanel
        account={null}
        autoCreate={false}
        customerId="customer-1"
        merchantSlug="ogabassey"
        onAccountCreated={vi.fn()}
        requiresConsent={false}
        surface="wallet_page"
      />
    );

    expect(capturedEvents('wallet_funding_surface_opened')).toEqual([
      [
        'wallet_funding_surface_opened',
        expect.objectContaining({
          surface: 'wallet_page',
          auto_create: false,
          has_existing_account: false,
          merchant_slug: 'ogabassey',
          customer_id: 'customer-1',
        }),
      ],
    ]);
  });

  it('defers the funnel-entry event until the merchant context resolves', () => {
    const { rerender } = render(
      <WalletFundingPanel
        account={null}
        autoCreate={false}
        customerId="customer-1"
        merchantSlug={undefined}
        onAccountCreated={vi.fn()}
        requiresConsent={false}
        surface="wallet_page"
      />
    );

    expect(capturedEvents('wallet_funding_surface_opened')).toEqual([]);

    rerender(
      <WalletFundingPanel
        account={null}
        autoCreate={false}
        customerId="customer-1"
        merchantSlug="ogabassey"
        onAccountCreated={vi.fn()}
        requiresConsent={false}
        surface="wallet_page"
      />
    );

    expect(capturedEvents('wallet_funding_surface_opened')).toEqual([
      [
        'wallet_funding_surface_opened',
        expect.objectContaining({ merchant_slug: 'ogabassey' }),
      ],
    ]);
  });

  it('reports the network reason when the create request throws', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockRejectedValue(new Error('offline'));

    render(
      <WalletFundingPanel
        account={null}
        merchantSlug="ogabassey"
        surface="utility_modal"
        onAccountCreated={vi.fn()}
        requiresConsent={true}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /get my account number/i })
    );

    await waitFor(() => {
      expect(capturedEvents('wallet_funding_account_create_failed')).toEqual([
        [
          'wallet_funding_account_create_failed',
          expect.objectContaining({
            surface: 'utility_modal',
            reason: 'network',
          }),
        ],
      ]);
    });
  });
});
