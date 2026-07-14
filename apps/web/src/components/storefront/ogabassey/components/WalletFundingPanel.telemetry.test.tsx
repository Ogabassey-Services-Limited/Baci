import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletFundingPanel } from './WalletFundingPanel';
import {
  capturedEventsFor,
  walletFundingAccount as account,
} from './wallet-funding-panel-test-fixtures';

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
  return capturedEventsFor(mockCaptureClientEvent, name);
}

/**
 * Telemetry-only coverage for the wallet bank-transfer funnel. The rendering /
 * interaction behaviour lives in `WalletFundingPanel.test.tsx`; both suites are
 * kept separate so each stays inside the 300-line modularity budget.
 */
describe('WalletFundingPanel telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('reports the attempt and the success on a completed account creation', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValue({
      ok: true,
      json: async () => ({ account, requiresConsent: false }),
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

    await waitFor(() => {
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
    expect(capturedEvents('wallet_funding_account_create_attempted')).toEqual([
      [
        'wallet_funding_account_create_attempted',
        expect.objectContaining({
          surface: 'utility_modal',
          merchant_slug: 'ogabassey',
        }),
      ],
    ]);
  });

  // Each of these is an explicit funding-account API `code`. They must survive
  // to PostHog verbatim: collapsing them to `other` would hide whether the
  // funnel drops on merchant config, a NUBAN conflict, storage, or Paystack.
  it.each([
    'CUSTOMER_PHONE_REQUIRED',
    'GATEWAY_NOT_CONFIGURED',
    'PAYSTACK_CUSTOMER_ERROR',
    'PAYSTACK_DVA_ERROR',
    'WALLET_DVA_DISABLED',
    'WALLET_DVA_ORDER_ALIAS_CONFLICT',
    'WALLET_DVA_RECEIVER_CONFLICT',
    'WALLET_DVA_STORAGE_ERROR',
    'WALLET_DVA_SUBACCOUNT_CONFLICT',
  ])('passes the API failure code %s through as the reason', async (code) => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValue({
      ok: false,
      json: async () => ({ code, error: 'Funding account unavailable' }),
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

    await waitFor(() => {
      expect(capturedEvents('wallet_funding_account_create_failed')).toEqual([
        [
          'wallet_funding_account_create_failed',
          expect.objectContaining({ surface: 'utility_modal', reason: code }),
        ],
      ]);
    });
  });

  it('collapses an unrecognized API failure code to other', async () => {
    const user = userEvent.setup();
    mockFetchWithCsrf.mockResolvedValue({
      ok: false,
      json: async () => ({
        code: 'SOMETHING_BRAND_NEW',
        error: 'Funding account unavailable',
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

    await waitFor(() => {
      expect(capturedEvents('wallet_funding_account_create_failed')).toEqual([
        [
          'wallet_funding_account_create_failed',
          expect.objectContaining({ reason: 'other' }),
        ],
      ]);
    });
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
