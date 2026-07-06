import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyV2Wallet } from './wallet';

const mockUseCustomerAuth = vi.hoisted(() => vi.fn());
const mockUseMerchantSafe = vi.hoisted(() => vi.fn());
const fundingPanelProps = vi.hoisted(
  () => ({ current: null }) as { current: Record<string, unknown> | null }
);

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: mockUseCustomerAuth,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: mockUseMerchantSafe,
}));

vi.mock('../components/empty-state', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock('../components/WalletFundingPanel', () => ({
  WalletFundingPanel: (props: Record<string, unknown>) => {
    fundingPanelProps.current = props;
    return <div data-testid="wallet-funding-panel" />;
  },
}));

const fundingAccount = {
  accountName: 'OGB / JOHN DOE',
  accountNumber: '9012345678',
  bankName: 'Wema Bank',
  provider: 'paystack',
};

describe('OgabasseyV2Wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fundingPanelProps.current = null;
    mockUseCustomerAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    mockUseMerchantSafe.mockReturnValue({ merchant: { slug: 'ogabassey' } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          balance: 2500,
          fundingAccount,
          requiresFundingAccountConsent: false,
          totalEarned: 2500,
          totalRedeemed: 0,
          transactions: [],
        }),
      })
    );
  });

  it('renders the fetched wallet balance', async () => {
    render(<OgabasseyV2Wallet />);

    expect(await screen.findByText('₦2,500.00')).toBeInTheDocument();
  });

  it('opens the bank-transfer funding panel from the Fund Wallet button', async () => {
    const user = userEvent.setup();
    render(<OgabasseyV2Wallet />);

    await screen.findByText('₦2,500.00');
    expect(
      screen.queryByTestId('wallet-funding-panel')
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /fund wallet/i }));

    expect(screen.getByTestId('wallet-funding-panel')).toBeInTheDocument();
    expect(fundingPanelProps.current).toMatchObject({
      account: fundingAccount,
      merchantSlug: 'ogabassey',
      requiresConsent: false,
    });
  });

  it('refetches the wallet when the funding panel requests a balance refresh', async () => {
    const user = userEvent.setup();
    render(<OgabasseyV2Wallet />);

    await screen.findByText('₦2,500.00');
    await user.click(screen.getByRole('button', { name: /fund wallet/i }));

    const onRefreshBalance = fundingPanelProps.current
      ?.onRefreshBalance as () => void;
    onRefreshBalance();

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });
  });
});
