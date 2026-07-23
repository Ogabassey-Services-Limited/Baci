import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WALLET_FUNDING_POLL } from '@/config/wallet-funding-poll';
import { WalletFundingPanel } from './WalletFundingPanel';
import { walletFundingAccount as account } from './wallet-funding-panel-test-fixtures';

/**
 * Check-loop behaviour for the NGN funding panel. Rendering/telemetry for the
 * account-creation flow live in `WalletFundingPanel.test.tsx` and
 * `WalletFundingPanel.telemetry.test.tsx`; this suite is separate so each stays
 * inside the 300-line modularity budget.
 */
const mockPoll = vi.hoisted(() => vi.fn());
const mockCaptureClientEvent = vi.hoisted(() => vi.fn());
const mockFetchWithCsrf = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('./wallet-funding-credit-api', () => ({
  walletFundingCreditApi: { poll: mockPoll },
}));
vi.mock('@/lib/posthog/capture-client-event', () => ({
  captureClientEvent: mockCaptureClientEvent,
}));
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: mockFetchWithCsrf }));
vi.mock('@/hooks/use-toast', () => ({ toast: mockToast }));

const knownTransaction = {
  amount: 200,
  balance_after: 200,
  created_at: '2026-07-13T09:00:00.000Z',
  description: 'Cashback',
  id: 'txn-old',
  source_type: 'cashback',
  type: 'credit',
};

function renderPanel(props: Record<string, unknown> = {}) {
  return render(
    <WalletFundingPanel
      account={account}
      merchantSlug="ogabassey"
      onAccountCreated={vi.fn()}
      onRefreshBalance={vi.fn()}
      requiresConsent={false}
      surface="wallet_page"
      walletTransactions={[knownTransaction]}
      {...props}
    />
  );
}

describe('WalletFundingPanel check loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoll.mockResolvedValue({ balance: 0, kind: 'ready', transactions: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe('with the dark-launch flag off', () => {
    it('keeps the manual refresh button and never polls', async () => {
      const user = userEvent.setup();
      const onRefreshBalance = vi.fn();

      renderPanel({ onRefreshBalance });
      await user.click(
        screen.getByRole('button', { name: /refresh balance/i })
      );

      expect(onRefreshBalance).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole('button', { name: /I've transferred/i })
      ).not.toBeInTheDocument();
      expect(mockPoll).not.toHaveBeenCalled();
    });
  });

  describe('with the dark-launch flag on', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', 'true');
    });

    it('replaces the manual refresh button with the check affordance', () => {
      renderPanel();

      expect(
        screen.getByRole('button', { name: /I've transferred/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /refresh balance/i })
      ).not.toBeInTheDocument();
      expect(mockPoll).not.toHaveBeenCalled();
    });

    it('arms → checks → announces the credit and refreshes the balance', async () => {
      const user = userEvent.setup();
      const onRefreshBalance = vi.fn();
      const onCredited = vi.fn();
      mockPoll.mockResolvedValue({
        balance: 5000,
        kind: 'ready',
        transactions: [
          {
            amount: 5000,
            id: 'txn-new',
            source_type: 'wallet_topup',
            type: 'credit',
          },
        ],
      });

      renderPanel({ onCredited, onRefreshBalance });
      await user.click(
        screen.getByRole('button', { name: /I've transferred/i })
      );

      expect(await screen.findByText(/Transfer received/i)).toBeInTheDocument();
      expect(onRefreshBalance).toHaveBeenCalledTimes(1);
      expect(onCredited).toHaveBeenCalledTimes(1);
    });

    it('does not announce a credit when only cashback lands', async () => {
      const user = userEvent.setup();
      const onCredited = vi.fn();
      mockPoll.mockResolvedValue({
        balance: 700,
        kind: 'ready',
        transactions: [
          {
            amount: 500,
            id: 'txn-cashback-new',
            source_type: 'cashback',
            type: 'credit',
          },
        ],
      });

      renderPanel({ onCredited });
      await user.click(
        screen.getByRole('button', { name: /I've transferred/i })
      );

      expect(
        await screen.findByText(/Checking for your transfer/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/Transfer received/i)).not.toBeInTheDocument();
      expect(onCredited).not.toHaveBeenCalled();
    });

    it('times out with copy that never claims the transfer landed', async () => {
      vi.useFakeTimers();
      const onCredited = vi.fn();

      renderPanel({ onCredited });
      // fireEvent, not userEvent: userEvent's own timers deadlock against
      // vi.useFakeTimers() in this jsdom setup.
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /I've transferred/i })
        );
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(
          WALLET_FUNDING_POLL.intervalMs * WALLET_FUNDING_POLL.maxAttempts
        );
      });

      expect(
        screen.getByText(/haven't seen your transfer yet/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/Transfer received/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Check again/i })
      ).toBeInTheDocument();
      expect(onCredited).not.toHaveBeenCalled();
    });

    it('stays dormant while the customer has no account number yet', () => {
      renderPanel({ account: null, requiresConsent: true });

      expect(
        screen.queryByRole('button', { name: /I've transferred/i })
      ).not.toBeInTheDocument();
      expect(mockPoll).not.toHaveBeenCalled();
    });
  });
});
