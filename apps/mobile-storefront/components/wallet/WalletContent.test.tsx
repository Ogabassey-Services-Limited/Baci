import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { setClipboardString } from '@/lib/clipboard';
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

jest.mock('@/lib/clipboard', () => ({
  setClipboardString: jest.fn(),
}));

const mockSetClipboardString = jest.mocked(setClipboardString);

describe('WalletContent', () => {
  const props = {
    colors: Colors.light,
    contentContainerStyle: { paddingBottom: 32, paddingTop: 20 },
    earningsBalance: 125000,
    fundAmount: '',
    fundingAccount: {
      accountName: 'Ogabassey/Jane Doe',
      accountNumber: '1234567890',
      bankName: 'Titan Paystack',
      provider: 'paystack' as const,
    },
    isCreatingFundingAccount: false,
    isFundPending: false,
    isRedeemPending: false,
    isRefetching: false,
    loyaltyPoints: 2000,
    onChangeFundAmount: jest.fn(),
    onCreateFundingAccount: jest.fn(),
    onChangeRedeemPoints: jest.fn(),
    onConfirmFund: jest.fn(),
    onConfirmRedeem: jest.fn(),
    onManageCards: jest.fn(),
    onOpenFundPanel: jest.fn(),
    onOpenRedeemPanel: jest.fn(),
    onQuickSave: jest.fn(),
    onRefresh: jest.fn(),
    onResetFund: jest.fn(),
    onResetRedeem: jest.fn(),
    onStartSavings: jest.fn(),
    redeemPoints: '',
    savingsBalance: 35000,
    showFundPanel: false,
    showQuickSave: true,
    showRedeemPanel: false,
    totalBalance: 160000,
    transactions: [
      {
        amount: 2500.75,
        created_at: '2026-04-21T12:30:00.000Z',
        description: 'Order cashback',
        id: 'tx-1',
        type: 'credit' as const,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetClipboardString.mockResolvedValue(true);
  });

  it('renders earnings, savings, loyalty points, and primary actions', () => {
    render(<WalletContent {...props} />);

    expect(screen.getByText('Wallet')).toBeOnTheScreen();
    expect(screen.getByText('Total Balance · NGN')).toBeOnTheScreen();
    expect(screen.getByText('₦160,000')).toBeOnTheScreen();
    expect(screen.getAllByText('Earnings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Savings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2,000 pts').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: 'Start savings' })
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Manage cards' })
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Withdraw from wallet' })).toBe(
      null
    );
  });

  it('copies the funding account number from the account pill', async () => {
    render(<WalletContent {...props} />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Copy funding account number' })
    );

    await waitFor(() =>
      expect(mockSetClipboardString).toHaveBeenCalledWith('1234567890')
    );
    expect(
      await screen.findByText('Account number copied to clipboard.')
    ).toBeOnTheScreen();
  });

  it('clears inline copy feedback after a short delay', async () => {
    jest.useFakeTimers();
    try {
      render(<WalletContent {...props} />);

      fireEvent.press(
        screen.getByRole('button', { name: 'Copy funding account number' })
      );

      expect(
        await screen.findByText('Account number copied to clipboard.')
      ).toBeOnTheScreen();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(
        screen.queryByText('Account number copied to clipboard.')
      ).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows inline feedback when account number copy fails', async () => {
    mockSetClipboardString.mockResolvedValue(false);
    render(<WalletContent {...props} />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Copy funding account number' })
    );

    expect(
      await screen.findByText('Could not copy account number.')
    ).toBeOnTheScreen();
  });

  it('shows create account button when no funding account exists', () => {
    render(<WalletContent {...props} fundingAccount={null} />);

    expect(
      screen.getByRole('button', { name: 'Create account number' })
    ).toBeOnTheScreen();
  });

  it('wires start savings, manage cards, and quick save actions', () => {
    render(<WalletContent {...props} />);

    fireEvent.press(screen.getByRole('button', { name: 'Start savings' }));
    fireEvent.press(screen.getByRole('button', { name: 'Manage cards' }));
    fireEvent.press(screen.getByRole('button', { name: 'Quick save' }));

    expect(props.onStartSavings).toHaveBeenCalledTimes(1);
    expect(props.onManageCards).toHaveBeenCalledTimes(1);
    expect(props.onQuickSave).toHaveBeenCalledTimes(1);
  });

  it('hides quick save when there is no active savings context', () => {
    render(<WalletContent {...props} showQuickSave={false} />);

    expect(screen.queryByRole('button', { name: 'Quick save' })).toBeNull();
  });

  it('does not update copy feedback after unmounting', async () => {
    let resolveClipboard: (copied: boolean) => void = () => undefined;
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSetClipboardString.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveClipboard = resolve;
      })
    );

    try {
      const { unmount } = render(<WalletContent {...props} />);

      fireEvent.press(
        screen.getByRole('button', { name: 'Copy funding account number' })
      );
      unmount();

      await act(async () => {
        resolveClipboard(true);
        // Flush the clipboard promise microtask before asserting no post-unmount state update.
        await Promise.resolve();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
