import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors, { palette } from '@/constants/Colors';
import WalletTabScreen from './wallet';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUseTheme = jest.fn();
const mockUseWallet = jest.fn();
const mockUseAuthStatus = jest.fn();

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

describe('WalletTabScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    expect(toJSON()).toBeNull();
  });
});
