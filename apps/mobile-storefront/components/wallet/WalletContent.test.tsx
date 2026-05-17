import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { WalletContent } from './WalletContent';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    __esModule: true,
    default: { View },
    FadeIn: {
      duration: () => ({
        delay: () => ({}),
      }),
    },
  };
});

describe('WalletContent', () => {
  const props = {
    colors: Colors.light,
    contentContainerStyle: { paddingTop: 20, paddingBottom: 32 },
    fundAmount: '',
    isFundPending: false,
    isRedeemPending: false,
    isRefetching: false,
    loyaltyPoints: 2000,
    onChangeFundAmount: jest.fn(),
    onChangeRedeemPoints: jest.fn(),
    onConfirmFund: jest.fn(),
    onConfirmRedeem: jest.fn(),
    onOpenFundPanel: jest.fn(),
    onOpenRedeemPanel: jest.fn(),
    onRefresh: jest.fn(),
    onResetFund: jest.fn(),
    onResetRedeem: jest.fn(),
    redeemPoints: '',
    showFundPanel: false,
    showRedeemPanel: false,
    transactions: [
      {
        amount: 2500.75,
        created_at: '2026-04-21T12:30:00.000Z',
        description: 'Order cashback',
        id: 'tx-1',
        type: 'credit' as const,
      },
    ],
    walletBalance: 125000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders wallet cards and transaction history with formatted values', () => {
    render(<WalletContent {...props} />);

    expect(screen.getByText('Wallet Balance')).toBeOnTheScreen();
    expect(screen.getByText('₦125,000')).toBeOnTheScreen();
    expect(screen.getByText('2,000 pts')).toBeOnTheScreen();
    expect(screen.getByText('Order cashback')).toBeOnTheScreen();
    expect(screen.getByText('+₦2,500.75')).toBeOnTheScreen();
  });

  it('opens the top-up panel and leaves only withdrawal disabled', () => {
    render(<WalletContent {...props} showFundPanel fundAmount="1000" />);

    fireEvent.press(screen.getByLabelText('Add funds to wallet'));
    fireEvent.changeText(screen.getByLabelText('Wallet top-up amount'), '2500');
    fireEvent.press(screen.getByLabelText('Confirm wallet top-up'));
    fireEvent.press(screen.getByLabelText('Cancel wallet top-up'));

    expect(props.onOpenFundPanel).toHaveBeenCalledTimes(1);
    expect(props.onChangeFundAmount).toHaveBeenCalledWith('2500');
    expect(props.onConfirmFund).toHaveBeenCalledTimes(1);
    expect(props.onResetFund).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Withdraw from wallet')).toBeDisabled();
    expect(screen.getByLabelText('Add funds to wallet')).not.toBeDisabled();
  });

  it('fires the redemption callbacks from the loyalty section and inline panel', () => {
    render(<WalletContent {...props} showRedeemPanel redeemPoints="150" />);

    fireEvent.press(screen.getByLabelText('Redeem loyalty points'));
    fireEvent.changeText(screen.getByLabelText('Points to redeem'), '250');
    fireEvent.press(screen.getByLabelText('Confirm redeem points'));
    fireEvent.press(screen.getByLabelText('Cancel redeem points'));

    expect(props.onOpenRedeemPanel).toHaveBeenCalledTimes(1);
    expect(props.onChangeRedeemPoints).toHaveBeenCalledWith('250');
    expect(props.onConfirmRedeem).toHaveBeenCalledTimes(1);
    expect(props.onResetRedeem).toHaveBeenCalledTimes(1);
  });

  it('shows the redeemable block balance and full point balance', () => {
    render(<WalletContent {...props} loyaltyPoints={250} showRedeemPanel />);

    expect(
      screen.getByText('200 points redeemable now - 100 points = ₦100')
    ).toBeOnTheScreen();
    expect(screen.getByText('Available: 250 points')).toBeOnTheScreen();
  });

  it('shows the empty-state copy when no transactions exist', () => {
    render(<WalletContent {...props} transactions={[]} />);

    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });
});
