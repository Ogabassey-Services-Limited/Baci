import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { WalletContent } from '@/app/wallet/WalletContent';

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
    isRedeemPending: false,
    isRefetching: false,
    loyaltyPoints: 2000,
    onChangeRedeemPoints: jest.fn(),
    onConfirmRedeem: jest.fn(),
    onOpenRedeemPanel: jest.fn(),
    onRefresh: jest.fn(),
    onResetRedeem: jest.fn(),
    redeemPoints: '',
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

  it('shows the empty-state copy when no transactions exist', () => {
    render(<WalletContent {...props} transactions={[]} />);

    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });
});
