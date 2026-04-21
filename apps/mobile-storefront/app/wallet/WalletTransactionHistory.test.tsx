import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import {
  type WalletTransaction,
  WalletTransactionHistory,
} from './WalletTransactionHistory';

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

describe('WalletTransactionHistory', () => {
  const transactions: WalletTransaction[] = [
    {
      amount: 2500.75,
      created_at: '2026-04-21T12:30:00.000Z',
      description: 'Order cashback',
      id: 'tx-1',
      type: 'credit',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders formatted transaction items', () => {
    render(
      <WalletTransactionHistory
        colors={Colors.light}
        transactions={transactions}
      />
    );

    expect(screen.getByText('Recent Transactions')).toBeTruthy();
    expect(screen.getByText('Order cashback')).toBeTruthy();
    expect(screen.getByText('+₦2,500.75')).toBeTruthy();
  });

  it('shows the empty state when there are no transactions', () => {
    render(
      <WalletTransactionHistory colors={Colors.light} transactions={[]} />
    );

    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });
});
