import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, Text, View } from 'react-native';
import WalletScreen from '@/app/wallet';
import { WALLET_TAB_SCROLL_PADDING_BOTTOM } from '@/components/wallet/wallet-tab.constants';
import { SPACING } from '@/constants/Colors';

type MockStorefrontScreenShellProps = {
  children?: ReactNode;
  edges?: readonly string[];
};

type MockWalletContentProps = {
  contentContainerStyle?: unknown;
  fundAmount: string;
  isFundPending: boolean;
  isRefetching?: boolean;
  loyaltyPoints?: number;
  onChangeFundAmount: (value: string) => void;
  onChangeRedeemPoints: (value: string) => void;
  onConfirmFund: () => void;
  onConfirmRedeem: () => void;
  onOpenFundPanel: () => void;
  onOpenRedeemPanel: () => void;
  onRefresh: () => void;
  onResetFund: () => void;
  onResetRedeem: () => void;
  redeemPoints: string;
  showFundPanel: boolean;
  showRedeemPanel: boolean;
  transactions?: unknown[];
  walletBalance?: number;
};

const mockRedirect = jest.fn<({ href }: { href: string }) => ReactNode>();
const mockRouterPush = jest.fn();
let mockSearchParams: { action?: string } = {};
const mockStorefrontScreenShell =
  jest.fn<({ children, edges }: MockStorefrontScreenShellProps) => void>();
const mockWalletContent =
  jest.fn<(props: MockWalletContentProps) => ReactNode>();
const mockGetScrollContentStyle = jest.fn();
const mockRefetch = jest.fn();
const mockMutateAsync =
  jest.fn<
    (points: number) => Promise<{
      conversionRate?: number;
      remainingPoints: number;
      walletCredit: number;
    }>
  >();
const mockTrackError = jest.fn();
const mockTrackEvent = jest.fn();
const mockScheduleLocalNotification = jest.fn();
const mockUseRequireAuth = jest.fn();
const mockUseWallet = jest.fn();
const mockUseRedeemPoints = jest.fn();
const mockUseStorefrontInsets = jest.fn();
const mockInitializeWalletTopUp =
  jest.fn<
    (input: unknown) => Promise<{
      authorization_url: string;
      gateway: 'paystack' | 'korapay';
      reference: string;
      success: true;
    }>
  >();
type MockAuthState = {
  customer: {
    email?: string;
    first_name?: string;
    id: string;
    last_name?: string;
    phone?: string;
  } | null;
  merchantId: string | null;
  user: { email?: string; id: string } | null;
};
const mockUseAuthStore = jest.fn<() => MockAuthState>();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => mockRedirect({ href }),
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: MockStorefrontScreenShellProps) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    mockStorefrontScreenShell({ children, ...props });
    return <View testID="storefront-screen-shell">{children}</View>;
  },
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/hooks/use-storefront-insets', () => ({
  useStorefrontInsets: () => mockUseStorefrontInsets(),
}));

jest.mock('@/hooks/use-wallet', () => ({
  useRedeemPoints: () => mockUseRedeemPoints(),
  useWallet: () => mockUseWallet(),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: {
    MERCHANT_ID: 'configured-merchant',
    MERCHANT_SLUG: 'ogabassey',
  },
}));

jest.mock('@/lib/wallet-top-up', () => ({
  initializeWalletTopUp: (input: unknown) => mockInitializeWalletTopUp(input),
}));

jest.mock('@/services/analytics', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@/services/push-notifications', () => ({
  scheduleLocalNotification: (...args: unknown[]) =>
    mockScheduleLocalNotification(...args),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: {
      customer: { id: string } | null;
      merchantId: string | null;
      user: { id: string } | null;
    }) => unknown
  ) => selector(mockUseAuthStore()),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
  }),
}));

jest.mock('@/components/wallet/WalletContent', () => ({
  WalletContent: (props: MockWalletContentProps) => mockWalletContent(props),
}));

describe('WalletScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockSearchParams = {};
    mockRedirect.mockImplementation(({ href }) => (
      <View testID="wallet-redirect" accessibilityLabel={href} />
    ));
    mockWalletContent.mockImplementation((props) => (
      <View testID="wallet-content">
        <Text>{`wallet-balance:${props.walletBalance ?? 0}`}</Text>
        <Text>{`show-fund-panel:${String(props.showFundPanel)}`}</Text>
        <Text>{`fund-amount:${props.fundAmount}`}</Text>
        <Text>{`fund-pending:${String(props.isFundPending)}`}</Text>
        <Text>{`loyalty-points:${props.loyaltyPoints ?? 0}`}</Text>
        <Text>{`show-redeem-panel:${String(props.showRedeemPanel)}`}</Text>
        <Text>{`redeem-points:${props.redeemPoints}`}</Text>
        <Text>{`transactions:${props.transactions?.length ?? 0}`}</Text>
        <Text>{`refreshing:${String(props.isRefetching)}`}</Text>
        <Text>{`content-style:${JSON.stringify(props.contentContainerStyle)}`}</Text>
        <Text accessibilityRole="button" onPress={props.onOpenFundPanel}>
          Open Fund Panel
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => props.onChangeFundAmount('50')}
        >
          Set Invalid Fund Amount
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => props.onChangeFundAmount('2500')}
        >
          Set Valid Fund Amount
        </Text>
        <Text accessibilityRole="button" onPress={props.onConfirmFund}>
          Confirm Fund
        </Text>
        <Text accessibilityRole="button" onPress={props.onResetFund}>
          Reset Fund
        </Text>
        <Text accessibilityRole="button" onPress={props.onOpenRedeemPanel}>
          Open Redeem Panel
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => props.onChangeRedeemPoints('0')}
        >
          Set Invalid Redeem Points
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => props.onChangeRedeemPoints('150')}
        >
          Set Valid Redeem Points
        </Text>
        <Text accessibilityRole="button" onPress={props.onConfirmRedeem}>
          Confirm Redeem
        </Text>
        <Text accessibilityRole="button" onPress={props.onResetRedeem}>
          Reset Redeem
        </Text>
        <Text accessibilityRole="button" onPress={props.onRefresh}>
          Refresh Wallet
        </Text>
      </View>
    ));
    mockGetScrollContentStyle.mockReturnValue({
      paddingTop: 20,
      paddingBottom: 32,
    });
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: mockGetScrollContentStyle,
    });
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
    });
    mockUseWallet.mockReturnValue({
      data: {
        wallet: {
          balance: 125000,
          loyalty_points: 2000,
        },
        transactions: [
          {
            amount: 2500,
            created_at: '2026-04-21T12:30:00.000Z',
            description: 'Order cashback',
            id: 'tx-1',
            type: 'credit',
          },
        ],
      },
      isError: false,
      isLoading: false,
      isRefetching: false,
      refetch: mockRefetch,
    });
    mockUseRedeemPoints.mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
    mockUseAuthStore.mockReturnValue({
      customer: {
        email: 'customer@example.com',
        first_name: 'Ada',
        id: 'customer-1',
        last_name: 'Lovelace',
        phone: '08012345678',
      },
      merchantId: 'merchant-1',
      user: { email: 'customer@example.com', id: 'user-1' },
    });
    mockInitializeWalletTopUp.mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/wallet',
      gateway: 'paystack',
      reference: 'WAL-123',
      success: true,
    });
  });

  it('uses the storefront shell, inset helper, and mapped wallet content props', () => {
    render(<WalletScreen />);

    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];
    const walletContentProps = mockWalletContent.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['bottom']);
    expect(mockGetScrollContentStyle).toHaveBeenCalledWith({
      includeBottomInset: false,
      paddingBottom: SPACING.xl,
    });
    expect(walletContentProps?.walletBalance).toBe(125000);
    expect(walletContentProps?.loyaltyPoints).toBe(2000);
    expect(walletContentProps?.transactions).toHaveLength(1);
  });

  it('renders as the wallet tab core screen without the pushed stack header', () => {
    render(<WalletScreen presentation="tab" />);

    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['top']);
    expect(screen.getByText('Wallet & Loyalty')).toBeOnTheScreen();
    expect(mockGetScrollContentStyle).toHaveBeenCalledWith({
      includeBottomInset: false,
      paddingBottom: WALLET_TAB_SCROLL_PADDING_BOTTOM,
    });
  });

  it('redirects unauthenticated users to the login flow', () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: '/auth/login?returnTo=%2Fwallet',
    });
    mockUseAuthStore.mockReturnValue({
      customer: null,
      merchantId: 'merchant-1',
      user: null,
    });

    render(<WalletScreen />);

    expect(mockRedirect).toHaveBeenCalledWith({
      href: '/auth/login?returnTo=%2Fwallet',
    });
    expect(screen.getByTestId('wallet-redirect').props.accessibilityLabel).toBe(
      '/auth/login?returnTo=%2Fwallet'
    );
  });

  it('shows the preparing state when the wallet owner context is not ready', () => {
    mockUseAuthStore.mockReturnValue({
      customer: null,
      merchantId: null,
      user: null,
    });

    render(<WalletScreen />);

    expect(screen.getByText('Preparing your wallet...')).toBeOnTheScreen();
    expect(screen.getByTestId('wallet-activity-indicator')).toBeOnTheScreen();
  });

  it('renders wallet data while the customer record is still hydrating', () => {
    mockUseAuthStore.mockReturnValue({
      customer: null,
      merchantId: 'merchant-1',
      user: { id: 'user-1' },
    });

    render(<WalletScreen />);

    expect(screen.getByText('wallet-balance:125000')).toBeOnTheScreen();
    expect(screen.queryByText('Preparing your wallet...')).toBeNull();
  });

  it('renders wallet data when auth merchant id is still hydrating but app config has one', () => {
    mockUseAuthStore.mockReturnValue({
      customer: null,
      merchantId: null,
      user: { email: 'customer@example.com', id: 'user-1' },
    });

    render(<WalletScreen />);

    expect(screen.getByText('wallet-balance:125000')).toBeOnTheScreen();
    expect(screen.queryByText('Preparing your wallet...')).toBeNull();
  });

  it('starts a wallet top-up and routes through the payment gateway', async () => {
    render(<WalletScreen />);

    fireEvent.press(screen.getByText('Open Fund Panel'));
    fireEvent.press(screen.getByText('Set Valid Fund Amount'));
    fireEvent.press(screen.getByText('Confirm Fund'));

    await waitFor(() => {
      expect(mockInitializeWalletTopUp).toHaveBeenCalledWith({
        amount: 2500,
        customerName: 'Ada Lovelace',
        customerPhone: '08012345678',
      });
    });
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/payment-gateway',
      params: {
        amount: '2500',
        authorizationUrl: 'https://checkout.paystack.com/wallet',
        gateway: 'paystack',
        paymentKind: 'wallet',
        reference: 'WAL-123',
      },
    });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'wallet_top_up_started',
      expect.objectContaining({
        amount: 2500,
        customer_id: 'customer-1',
        gateway: 'paystack',
      })
    );
  });

  it('opens the wallet top-up panel from the route action', () => {
    mockSearchParams = { action: 'fund' };

    render(<WalletScreen />);

    expect(screen.getByText('show-fund-panel:true')).toBeOnTheScreen();
    expect(screen.getByText('show-redeem-panel:false')).toBeOnTheScreen();
  });

  it('opens the reward redemption panel from the route action', () => {
    mockSearchParams = { action: 'redeem' };

    render(<WalletScreen />);

    expect(screen.getByText('show-fund-panel:false')).toBeOnTheScreen();
    expect(screen.getByText('show-redeem-panel:true')).toBeOnTheScreen();
  });

  it('blocks invalid wallet top-up amounts before calling the API', () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    render(<WalletScreen />);

    fireEvent.press(screen.getByText('Open Fund Panel'));
    fireEvent.press(screen.getByText('Set Invalid Fund Amount'));
    fireEvent.press(screen.getByText('Confirm Fund'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid Amount',
      'Wallet top-up amount must be between ₦100 and ₦500,000.'
    );
    expect(mockInitializeWalletTopUp).not.toHaveBeenCalled();
  });

  it('blocks invalid loyalty point redemption before hitting the mutation', () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    render(<WalletScreen />);

    fireEvent.press(screen.getByText('Open Redeem Panel'));
    fireEvent.press(screen.getByText('Set Invalid Redeem Points'));
    fireEvent.press(screen.getByText('Confirm Redeem'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid Input',
      'Please enter a valid number of points'
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('tracks and announces successful point redemptions', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    mockMutateAsync.mockResolvedValue({
      conversionRate: 1,
      remainingPoints: 1850,
      walletCredit: 150,
    });

    render(<WalletScreen />);

    fireEvent.press(screen.getByText('Open Redeem Panel'));
    fireEvent.press(screen.getByText('Set Valid Redeem Points'));
    fireEvent.press(screen.getByText('Confirm Redeem'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(150);
    });

    expect(mockTrackEvent).toHaveBeenCalledWith(
      'loyalty_redeemed',
      expect.objectContaining({
        customer_id: 'customer-1',
        points_redeemed: 150,
        wallet_credit: 150,
      })
    );
    expect(mockScheduleLocalNotification).toHaveBeenCalledWith(
      'Points Redeemed! 🎁',
      '150 points converted to ₦150 wallet credit.',
      { type: 'loyalty_redemption', points: 150 },
      1
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Points Redeemed!',
      '150 points converted to ₦150 wallet credit.',
      expect.any(Array)
    );

    const successActions = alertSpy.mock.calls.at(-1)?.[2];
    if (Array.isArray(successActions)) {
      act(() => {
        successActions[0]?.onPress?.();
      });
    }

    await waitFor(() => {
      const walletContentProps = mockWalletContent.mock.calls.at(-1)?.[0];
      expect(walletContentProps?.redeemPoints).toBe('');
      expect(walletContentProps?.showRedeemPanel).toBe(false);
    });
  });

  it('reports redeem failures without swallowing the backend message', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    mockMutateAsync.mockRejectedValueOnce(new Error('Redeem failed'));

    render(<WalletScreen />);

    fireEvent.press(screen.getByText('Open Redeem Panel'));
    fireEvent.press(screen.getByText('Set Valid Redeem Points'));
    fireEvent.press(screen.getByText('Confirm Redeem'));

    await waitFor(() => {
      expect(mockTrackError).toHaveBeenCalledWith(
        'loyalty_redemption_failed',
        'Redeem failed',
        expect.objectContaining({
          customer_id: 'customer-1',
          points_attempted: 150,
        })
      );
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Redeem failed');
  });
});
