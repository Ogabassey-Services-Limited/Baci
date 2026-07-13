import { fireEvent, render, screen } from '@testing-library/react-native';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';

let mockFlagEnabled = false;

jest.mock('@/constants/wallet-funding', () => ({
  get WALLET_FUNDING_CHECKING_STATE_ENABLED() {
    return mockFlagEnabled;
  },
}));

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (route: unknown) => mockRouterPush(route) },
}));

import { UtilityWalletTransferNudge } from '@/components/utilities/UtilityWalletTransferNudge';
import Colors from '@/constants/Colors';

const RETURN_TO =
  '/utilities/airtime?repeatAmount=1000&repeatPhoneNumber=08012345678' as WalletReturnHref;

const baseProps = {
  amount: 1000,
  canFundByBankTransfer: true,
  colors: Colors.light,
  hasWalletToggle: true,
  walletBalance: 200,
  walletError: null,
  walletIsLoading: false,
};

describe('UtilityWalletTransferNudge', () => {
  beforeEach(() => {
    mockFlagEnabled = false;
    jest.clearAllMocks();
  });

  it('shows the fee copy and deep-links to the wallet bank-transfer flow', () => {
    render(<UtilityWalletTransferNudge {...baseProps} />);

    expect(
      screen.getByText(/transfers to your wallet account number cost 1%/i)
    ).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', { name: 'Pay with Bank Transfer' })
    );

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/wallet',
      params: { action: 'bank-transfer' },
    });
  });

  it('round-trips a prefilled returnTo and requiredAmount when the flag is on', () => {
    mockFlagEnabled = true;
    render(
      <UtilityWalletTransferNudge {...baseProps} returnToHref={RETURN_TO} />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Pay with Bank Transfer' })
    );

    expect(mockRouterPush).toHaveBeenCalledWith(
      `/wallet?action=bank-transfer&requiredAmount=1000&returnTo=${encodeURIComponent(RETURN_TO)}`
    );
  });

  it('rounds the required amount up for the wallet top-up target', () => {
    mockFlagEnabled = true;
    render(
      <UtilityWalletTransferNudge
        {...baseProps}
        amount={999.2}
        walletBalance={0}
        returnToHref={RETURN_TO}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Pay with Bank Transfer' })
    );

    expect(mockRouterPush).toHaveBeenCalledWith(
      `/wallet?action=bank-transfer&requiredAmount=1000&returnTo=${encodeURIComponent(RETURN_TO)}`
    );
  });

  it('keeps the legacy object push when the flag is off even with a returnTo', () => {
    mockFlagEnabled = false;
    render(
      <UtilityWalletTransferNudge {...baseProps} returnToHref={RETURN_TO} />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Pay with Bank Transfer' })
    );

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/wallet',
      params: { action: 'bank-transfer' },
    });
  });

  it('opens the wallet with no return route when the flag is on but no href is provided', () => {
    mockFlagEnabled = true;
    render(<UtilityWalletTransferNudge {...baseProps} />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Pay with Bank Transfer' })
    );

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/wallet',
      params: { action: 'bank-transfer' },
    });
  });

  it('is hidden when bank transfer is not available for the customer/merchant', () => {
    render(
      <UtilityWalletTransferNudge
        {...baseProps}
        canFundByBankTransfer={false}
      />
    );

    expect(screen.queryByText(/Pay with Bank Transfer/i)).toBeNull();
  });

  it('is hidden when the wallet already covers the bill', () => {
    render(
      <UtilityWalletTransferNudge
        {...baseProps}
        amount={1000}
        walletBalance={5000}
      />
    );

    expect(screen.queryByText(/Pay with Bank Transfer/i)).toBeNull();
  });

  it('is hidden when the screen has not opted into wallet payments', () => {
    render(
      <UtilityWalletTransferNudge {...baseProps} hasWalletToggle={false} />
    );

    expect(screen.queryByText(/Pay with Bank Transfer/i)).toBeNull();
  });

  it('is hidden while the wallet balance is still loading', () => {
    render(
      <UtilityWalletTransferNudge {...baseProps} walletIsLoading={true} />
    );

    expect(screen.queryByText(/Pay with Bank Transfer/i)).toBeNull();
  });

  it('is hidden when the wallet lookup errored', () => {
    render(
      <UtilityWalletTransferNudge
        {...baseProps}
        walletError={new Error('wallet unavailable')}
      />
    );

    expect(screen.queryByText(/Pay with Bank Transfer/i)).toBeNull();
  });
});
