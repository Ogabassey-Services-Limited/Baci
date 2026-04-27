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
import { SPACING } from '@/constants/Colors';
import WalletScreen from '@/app/wallet/index';

type MockStorefrontScreenShellProps = {
  children?: ReactNode;
  edges?: readonly string[];
};

type MockWalletContentProps = {
  contentContainerStyle?: unknown;
  isRefetching?: boolean;
  loyaltyPoints?: number;
  onChangeRedeemPoints: (value: string) => void;
  onConfirmRedeem: () => void;
  onOpenRedeemPanel: () => void;
  onRefresh: () => void;
  onResetRedeem: () => void;
  redeemPoints: string;
  showRedeemPanel: boolean;
  transactions?: unknown[];
  walletBalance?: number;
};

const mockRedirect = jest.fn<({ href }: { href: string }) => ReactNode>();
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
const mockUseAuthStore = jest.fn<() => { id: string } | null>();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => mockRedirect({ href }),
  Stack: {
    Screen: () => null,
  },
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
    }) => { id: string } | null
  ) =>
    selector({
      customer: mockUseAuthStore(),
    }),
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
    mockRedirect.mockImplementation(({ href }) => (
      <View testID="wallet-redirect" accessibilityLabel={href} />
    ));
    mockWalletContent.mockImplementation((props) => (
      <View testID="wallet-content">
        <Text>{`wallet-balance:${props.walletBalance ?? 0}`}</Text>
        <Text>{`loyalty-points:${props.loyaltyPoints ?? 0}`}</Text>
        <Text>{`show-redeem-panel:${String(props.showRedeemPanel)}`}</Text>
        <Text>{`redeem-points:${props.redeemPoints}`}</Text>
        <Text>{`transactions:${props.transactions?.length ?? 0}`}</Text>
        <Text>{`refreshing:${String(props.isRefetching)}`}</Text>
        <Text>{`content-style:${JSON.stringify(props.contentContainerStyle)}`}</Text>
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
      isLoading: false,
      isRefetching: false,
      refetch: mockRefetch,
    });
    mockUseRedeemPoints.mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
    mockUseAuthStore.mockReturnValue({
      id: 'customer-1',
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

  it('redirects unauthenticated users to the login flow', () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: '/auth/login?returnTo=%2Fwallet',
    });
    mockUseAuthStore.mockReturnValue(null);

    render(<WalletScreen />);

    expect(mockRedirect).toHaveBeenCalledWith({
      href: '/auth/login?returnTo=%2Fwallet',
    });
    expect(screen.getByTestId('wallet-redirect').props.accessibilityLabel).toBe(
      '/auth/login?returnTo=%2Fwallet'
    );
  });

  it('shows the preparing state when the customer record is not ready', () => {
    mockUseAuthStore.mockReturnValue(null);

    render(<WalletScreen />);

    expect(screen.getByText('Preparing your wallet...')).toBeTruthy();
    expect(screen.getByTestId('wallet-activity-indicator')).toBeTruthy();
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
