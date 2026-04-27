import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { WALLET_TAB_SCROLL_PADDING_BOTTOM } from '@/components/wallet/wallet-tab.constants';
import Colors, { palette, SPACING } from '@/constants/Colors';
import WalletTabScreen from '@/app/(tabs)/wallet';

interface MockStorefrontScreenShellProps {
  children?: ReactNode;
  edges?: string[];
}

type MockScrollStyleOptions = {
  includeBottomInset?: boolean;
  paddingBottom?: number;
};

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUseTheme = jest.fn();
const mockUseWallet = jest.fn();
const mockUseAuthStatus = jest.fn();
const mockUseStorefrontInsets = jest.fn();
const mockStorefrontScreenShell = jest.fn(
  ({ children }: MockStorefrontScreenShellProps) => (
    <View testID="storefront-screen-shell">{children}</View>
  )
);
const mockGetScrollContentStyle = jest.fn(
  (options?: MockScrollStyleOptions) => ({
    paddingTop: 16,
    paddingBottom:
      options?.paddingBottom ??
      (options?.includeBottomInset === false ? 100 : 134),
  })
);

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => mockUseWallet(),
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useAuthStatus: () => mockUseAuthStatus(),
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: MockStorefrontScreenShellProps) =>
    mockStorefrontScreenShell({ children, ...props }),
}));

jest.mock('@/hooks/use-storefront-insets', () => ({
  useStorefrontInsets: () => mockUseStorefrontInsets(),
}));

describe('WalletTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: mockGetScrollContentStyle,
      getListContentStyle: jest.fn(),
    });
    mockUseTheme.mockReturnValue({
      colors: Colors.dark,
      isDark: true,
    });
    mockUseWallet.mockReturnValue({
      data: {
        wallet: {
          balance: 125000,
          loyalty_points: 2000,
        },
      },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    mockUseAuthStatus.mockReturnValue({
      customer: null,
      isAuthenticated: true,
      isGuest: false,
      isInitialized: true,
      isLoading: false,
      user: { id: 'user-1' },
    });
  });

  it('uses the storefront shell and scroll padding helper for the wallet tab layout', () => {
    render(<WalletTabScreen />);
    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];
    const scrollView = screen.getByTestId('wallet-scrollview');

    expect(shellProps?.edges).toEqual(['top']);
    expect(mockGetScrollContentStyle).toHaveBeenCalledWith({
      includeBottomInset: false,
      paddingBottom: WALLET_TAB_SCROLL_PADDING_BOTTOM,
    });
    expect(StyleSheet.flatten(scrollView.props.contentContainerStyle)).toEqual({
      gap: SPACING.lg,
      paddingHorizontal: SPACING.lg,
      paddingTop: 16,
      paddingBottom: WALLET_TAB_SCROLL_PADDING_BOTTOM,
    });
  });

  it('renders wallet content with the active theme colors', () => {
    render(<WalletTabScreen />);

    expect(
      StyleSheet.flatten(screen.getByText('Wallet').props.style)
    ).toMatchObject({ color: Colors.dark.text });
    expect(
      StyleSheet.flatten(screen.getByText('Available Balance').props.style)
    ).toMatchObject({ color: Colors.dark.textSecondary });
    expect(
      StyleSheet.flatten(screen.getByText('Add Funds').props.style)
    ).toMatchObject({ color: Colors.dark.text });
  });

  it('switches the reward points styling for the light theme', () => {
    mockUseTheme.mockReturnValue({
      colors: Colors.light,
      isDark: false,
    });

    render(<WalletTabScreen />);

    expect(
      StyleSheet.flatten(screen.getByText('Reward Points').props.style)
    ).toMatchObject({ color: palette.amber[800] });
    expect(
      StyleSheet.flatten(screen.getByText('Redeem Points').props.style)
    ).toMatchObject({ color: Colors.light.secondaryForeground });
  });

  it('navigates to the full wallet screen from the history affordance', () => {
    render(<WalletTabScreen />);

    fireEvent.press(screen.getByLabelText('Open wallet history'));

    expect(mockPush).toHaveBeenCalledWith('/wallet');
  });

  it('redirects away when the user is unauthenticated', () => {
    mockUseAuthStatus.mockReturnValue({
      customer: null,
      isAuthenticated: false,
      isGuest: true,
      isInitialized: true,
      isLoading: false,
      user: null,
    });

    const { toJSON } = render(<WalletTabScreen />);

    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(toJSON()).toBeNull();
  });
});
