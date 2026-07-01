import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiCheckDevicePage } from './ImeiCheckDevicePage';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const baseProps = {
  colors: Colors.light,
  error: null as string | null,
  isLoading: false,
  isWalletError: false,
  isWalletLoading: false,
  walletBalance: 50_000,
  onVerify: jest.fn(),
  onTopUpWallet: jest.fn(),
};

describe('ImeiCheckDevicePage', () => {
  it('defaults to the recommended check for the given device', () => {
    render(<ImeiCheckDevicePage {...baseProps} device="laptop" />);

    // Mac's recommended flagship is the iCloud lock check.
    expect(screen.getByText('Mac iCloud Lock')).toBeTruthy();
    expect(screen.getByText(/Verify Now/)).toBeTruthy();
  });

  it('hides the brand filter for non-phone devices', () => {
    render(<ImeiCheckDevicePage {...baseProps} device="laptop" />);

    // Brand chips are phone-only; Samsung must not appear on a Mac page.
    expect(screen.queryByText('Samsung')).toBeNull();
  });
});
