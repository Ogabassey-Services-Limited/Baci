import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { setClipboardString } from '@/lib/clipboard';
import { WalletHeroSection } from './WalletHeroSection';

const mockTriggerHaptic = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

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

jest.mock('@/hooks/use-haptics', () => ({
  triggerHaptic: (...args: unknown[]) => mockTriggerHaptic(...args),
}));

const mockSetClipboardString = jest.mocked(setClipboardString);

const baseProps = {
  accentColor: '#2563EB',
  canCreateFundingAccount: true,
  creditWatch: {
    armCheck: jest.fn(),
    creditedAmount: null,
    reset: jest.fn(),
    returnCtaHref: undefined,
    status: 'idle' as const,
  },
  earningsBalance: 125000,
  fundingAccount: {
    accountName: 'Ogabassey/Jane Doe',
    accountNumber: '1234567890',
    bankName: 'Titan Paystack',
    provider: 'paystack' as const,
  },
  isCreatingFundingAccount: false,
  loyaltyPoints: 2000,
  loyaltyTier: 'silver',
  needsPhone: false,
  onCreateFundingAccount: jest.fn(),
  onOpenRedeemPanel: jest.fn(),
  onOpenFundPanel: jest.fn(),
  savingsBalance: 35000,
  totalBalance: 160000,
};

describe('WalletHeroSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetClipboardString.mockResolvedValue(true);
  });

  it('renders wallet balances and account actions', () => {
    render(<WalletHeroSection {...baseProps} />);

    expect(screen.getByText('Wallet')).toBeOnTheScreen();
    expect(screen.getByText('Total Balance · NGN')).toBeOnTheScreen();
    expect(screen.getByText('₦160,000')).toBeOnTheScreen();
    expect(screen.getAllByText('Earnings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Savings').length).toBeGreaterThan(0);
    expect(screen.getByText('2,000 pts')).toBeOnTheScreen();
    expect(screen.getByText('REDEEM')).toBeOnTheScreen();
    expect(screen.getByText('Silver')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add money' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Redeem loyalty points' })
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Copy funding account number' })
    ).toBeOnTheScreen();
    expect(screen.getByText('Quick Utilities')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Buy Airtime' })
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Buy Data' })).toBeOnTheScreen();
  });

  it('copies the funding account number and clears feedback after the timeout', async () => {
    jest.useFakeTimers();
    try {
      render(<WalletHeroSection {...baseProps} />);

      fireEvent.press(
        screen.getByRole('button', { name: 'Copy funding account number' })
      );

      await waitFor(() =>
        expect(mockSetClipboardString).toHaveBeenCalledWith('1234567890')
      );
      expect(mockTriggerHaptic).toHaveBeenCalledWith('success');
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

  it('shows create account action when no funding account exists', () => {
    const onCreateFundingAccount = jest.fn();

    render(
      <WalletHeroSection
        {...baseProps}
        fundingAccount={null}
        onCreateFundingAccount={onCreateFundingAccount}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Create account number' })
    );

    expect(onCreateFundingAccount).toHaveBeenCalledTimes(1);
  });

  it('disables account creation with an inline unavailable reason', () => {
    const onCreateFundingAccount = jest.fn();

    render(
      <WalletHeroSection
        {...baseProps}
        canCreateFundingAccount={false}
        createFundingAccountUnavailableMessage="Bank transfer account creation is not available yet."
        fundingAccount={null}
        onCreateFundingAccount={onCreateFundingAccount}
      />
    );

    const createAccountButton = screen.getByRole('button', {
      name: 'Create account number',
    });

    fireEvent.press(createAccountButton);

    expect(createAccountButton.props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(
      screen.getByText('Bank transfer account creation is not available yet.')
    ).toBeOnTheScreen();
    expect(onCreateFundingAccount).not.toHaveBeenCalled();
  });

  it('enables account creation and opens the fund panel when a phone is needed', () => {
    const onCreateFundingAccount = jest.fn();
    const onOpenFundPanel = jest.fn();

    render(
      <WalletHeroSection
        {...baseProps}
        canCreateFundingAccount={false}
        fundingAccount={null}
        needsPhone={true}
        onCreateFundingAccount={onCreateFundingAccount}
        onOpenFundPanel={onOpenFundPanel}
      />
    );

    const createAccountButton = screen.getByRole('button', {
      name: 'Create account number',
    });

    expect(createAccountButton.props.accessibilityState).toMatchObject({
      disabled: false,
    });

    fireEvent.press(createAccountButton);

    // Opens the panel (phone prompt) instead of firing a doomed create call.
    expect(onOpenFundPanel).toHaveBeenCalledTimes(1);
    expect(onCreateFundingAccount).not.toHaveBeenCalled();
  });

  it('opens loyalty redemption from the hero without a duplicate rewards card', () => {
    render(<WalletHeroSection {...baseProps} />);

    expect(screen.queryByText('Redeem Rewards')).toBeNull();

    fireEvent.press(
      screen.getByRole('button', { name: 'Redeem loyalty points' })
    );

    expect(baseProps.onOpenRedeemPanel).toHaveBeenCalledTimes(1);
  });

  it('allows opening redemption panel even with low points to see rankings and conversions', () => {
    render(<WalletHeroSection {...baseProps} loyaltyPoints={50} />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Redeem loyalty points' })
    );

    expect(baseProps.onOpenRedeemPanel).toHaveBeenCalledTimes(1);
  });

  it('navigates to utility purchase screen when a utility pill is pressed', () => {
    render(<WalletHeroSection {...baseProps} />);

    fireEvent.press(screen.getByRole('button', { name: 'Buy Airtime' }));
    expect(mockPush).toHaveBeenCalledWith('/utilities/airtime');

    fireEvent.press(screen.getByRole('button', { name: 'Buy Data' }));
    expect(mockPush).toHaveBeenCalledWith('/utilities/data');
  });
});
