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

jest.mock('@/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('@/hooks/use-products', () => ({
  useProducts: () => ({
    isLoading: false,
    products: [
      {
        condition: 'Used',
        id: 'product-swap',
        image: 'https://cdn.example.com/swap.jpg',
        name: 'iPhone 16 Pro',
        price: 150000,
        slug: 'iphone-16-pro',
      },
    ],
  }),
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

// Default off (production state); individual tests flip it on to exercise the
// credit-check affordance.
let mockCheckingStateEnabled = false;

jest.mock('@/constants/wallet-funding', () => ({
  get WALLET_FUNDING_CHECKING_STATE_ENABLED() {
    return mockCheckingStateEnabled;
  },
  WALLET_FUNDING_POLLING: { INTERVAL_MS: 5000, TIMEOUT_MS: 120000 },
}));

const mockSetClipboardString = jest.mocked(setClipboardString);

describe('WalletContent', () => {
  const props = {
    activeSavingsGoal: {
      contribution_amount: 10000,
      contribution_frequency: 'weekly' as const,
      current_amount: 50000,
      id: 'goal-1',
      maturity_date: '2026-09-30',
      product_condition: 'Used',
      product_image: 'https://cdn.example.com/device.jpg',
      product_variant_label: 'Storage: 256GB',
      source_mode: 'manual' as const,
      status: 'active' as const,
      target_amount: 100000,
      title: 'iPhone 15 Pro',
    },
    canCreateFundingAccount: true,
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
    isAddingSavingsContribution: false,
    isCreatingFundingAccount: false,
    isFundPending: false,
    isRedeemPending: false,
    isRefetching: false,
    loyaltyPoints: 2000,
    needsPhone: false,
    onChangeFundAmount: jest.fn(),
    onCreateFundingAccount: jest.fn(),
    onChangeRedeemPoints: jest.fn(),
    onAddSavingsContribution: jest.fn(),
    onChangeSavingsDevice: jest.fn(async () => true),
    onChangeSavingsContributionAmount: jest.fn(),
    onCloseSavingsProgress: jest.fn(),
    onConfirmFund: jest.fn(),
    onConfirmRedeem: jest.fn(),
    onFundSavingsWallet: jest.fn(),
    onManageCards: jest.fn(),
    onOpenFundPanel: jest.fn(),
    onOpenRedeemPanel: jest.fn(),
    onQuickSave: jest.fn(),
    onRefresh: jest.fn(),
    onResetFund: jest.fn(),
    onResetRedeem: jest.fn(),
    onStartSavings: jest.fn(),
    onSubmitPhone: jest.fn(async () => ({ success: true })),
    redeemPoints: '',
    savingsContributionAmount: '',
    savingsBalance: 35000,
    showFundPanel: false,
    showQuickSave: true,
    showRedeemPanel: false,
    showSavingsProgress: false,
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
    mockCheckingStateEnabled = false;
    mockSetClipboardString.mockResolvedValue(true);
  });

  it('mounts a single credit-check affordance while the fund panel is open', () => {
    mockCheckingStateEnabled = true;

    render(<WalletContent {...props} showFundPanel={true} />);

    // The fund panel owns the interactive affordance; the hero must not mount
    // a duplicate alongside it.
    expect(
      screen.getAllByRole('button', {
        name: "I've transferred — check for it",
      })
    ).toHaveLength(1);
  });

  it('shows the hero credit-check affordance when the fund panel is closed', () => {
    mockCheckingStateEnabled = true;

    render(<WalletContent {...props} showFundPanel={false} />);

    expect(
      screen.getAllByRole('button', {
        name: "I've transferred — check for it",
      })
    ).toHaveLength(1);
  });

  it('renders earnings, savings, loyalty points, and primary actions', () => {
    render(<WalletContent {...props} />);

    expect(screen.getByText('Wallet')).toBeOnTheScreen();
    expect(screen.getByText('Total Balance · NGN')).toBeOnTheScreen();
    expect(screen.getByText('₦160,000')).toBeOnTheScreen();
    expect(screen.getAllByText('Earnings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Savings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2,000 pts')).toHaveLength(1);
    expect(screen.queryByText('Redeem Rewards')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Redeem loyalty points' })
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add to Savings' })
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Manage Cards' })
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

  it('passes through account creation unavailable messaging', () => {
    render(
      <WalletContent
        {...props}
        canCreateFundingAccount={false}
        createFundingAccountUnavailableMessage="Add a phone number to create your account number."
        fundingAccount={null}
      />
    );

    expect(
      screen.getByText('Add a phone number to create your account number.')
    ).toBeOnTheScreen();
  });

  it('shows the phone prompt in the fund panel when a phone is needed', () => {
    render(
      <WalletContent
        {...props}
        canCreateFundingAccount={false}
        fundingAccount={null}
        needsPhone={true}
        showFundPanel={true}
      />
    );

    expect(screen.getByLabelText('Phone number')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Save phone number' })
    ).toBeOnTheScreen();
  });

  it('wires start savings, manage cards, and quick save actions', () => {
    render(<WalletContent {...props} />);

    fireEvent.press(screen.getByRole('button', { name: 'Add to Savings' }));
    fireEvent.press(screen.getByRole('button', { name: 'Manage Cards' }));
    fireEvent.press(screen.getByRole('button', { name: 'Quick Save' }));

    expect(props.onStartSavings).toHaveBeenCalledTimes(1);
    expect(props.onManageCards).toHaveBeenCalledTimes(1);
    expect(props.onQuickSave).toHaveBeenCalledTimes(1);
  });

  it('opens loyalty redemption from the hero loyalty row', () => {
    render(<WalletContent {...props} />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Redeem loyalty points' })
    );

    expect(props.onOpenRedeemPanel).toHaveBeenCalledTimes(1);
  });

  it('hides quick save when there is no active savings context', () => {
    render(
      <WalletContent
        {...props}
        activeSavingsGoal={null}
        showQuickSave={false}
      />
    );

    expect(screen.queryByRole('button', { name: 'Quick Save' })).toBeNull();
  });

  it('renders savings progress modal and wires manual contribution actions', async () => {
    render(<WalletContent {...props} showSavingsProgress />);

    expect(screen.getByText('Saving streak')).toBeOnTheScreen();
    expect(screen.getByText('50%')).toBeOnTheScreen();
    expect(screen.getByText('Used')).toBeOnTheScreen();
    expect(screen.getByText('Storage: 256GB')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Savings top-up amount'), '500');
    fireEvent.press(
      screen.getByRole('button', { name: 'Confirm savings top-up' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Fund wallet for savings' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Change savings device' })
    );
    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'Select iPhone 16 Pro' })
      );
      await Promise.resolve();
    });

    expect(props.onChangeSavingsContributionAmount).toHaveBeenCalledWith('500');
    expect(props.onAddSavingsContribution).toHaveBeenCalledTimes(1);
    expect(props.onFundSavingsWallet).toHaveBeenCalledTimes(1);
    expect(props.onChangeSavingsDevice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-swap' }),
      null
    );
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
