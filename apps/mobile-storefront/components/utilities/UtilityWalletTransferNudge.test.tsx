import { fireEvent, render, screen } from '@testing-library/react-native';
import { UtilityWalletTransferNudge } from '@/components/utilities/UtilityWalletTransferNudge';
import Colors from '@/constants/Colors';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (route: unknown) => mockRouterPush(route) },
}));

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
