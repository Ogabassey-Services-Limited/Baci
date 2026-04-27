import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Colors, { SPACING } from '@/constants/Colors';
import UtilityHistoryScreen from '@/app/utilities/history';

interface MockStorefrontScreenShellProps {
  children?: ReactNode;
  edges?: readonly string[];
  style?: unknown;
}

const mockStorefrontScreenShell = jest.fn(
  ({ children }: MockStorefrontScreenShellProps) => (
    <View testID="storefront-screen-shell">{children}</View>
  )
);
const mockGetScrollContentStyle = jest.fn();
const mockUseStorefrontInsets = jest.fn();
const mockUseRequireAuth = jest.fn();
const mockUseColorScheme = jest.fn(() => 'light');
const mockUseVTUHistory = jest.fn();
const mockRefetch = jest.fn(async () => undefined);

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: MockStorefrontScreenShellProps) =>
    mockStorefrontScreenShell({ children, ...props }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockUseColorScheme(),
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/hooks/use-storefront-insets', () => ({
  useStorefrontInsets: () => mockUseStorefrontInsets(),
}));

jest.mock('@/hooks/use-vtu-history', () => ({
  useVTUHistory: (...args: unknown[]) => mockUseVTUHistory(...args),
}));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>{`Redirect:${href}`}</Text>;
  },
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({ type: 'power' }),
}));

describe('UtilityHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
    mockGetScrollContentStyle.mockReturnValue({
      paddingTop: SPACING.md,
      paddingBottom: SPACING.md,
    });
    mockUseStorefrontInsets.mockReturnValue({
      getListContentStyle: jest.fn(),
      getScrollContentStyle: mockGetScrollContentStyle,
    });
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
    });
    mockUseVTUHistory.mockReturnValue({
      data: [
        {
          id: 'tx-1',
          created_at: '2026-04-08T12:00:00.000Z',
          type: 'electricity',
          status: 'successful',
          amount: 2500,
          biller_name: 'EKEDC NG',
          customer_identifier: '1234567890',
          request_reference: 'VTU-123',
          customer_cashback: 100,
        },
      ],
      error: null,
      isLoading: false,
      isRefetching: false,
      refetch: mockRefetch,
    });
  });

  it('uses the storefront shell and scroll inset helper for the history layout', () => {
    render(<UtilityHistoryScreen />);

    expect(mockStorefrontScreenShell).toHaveBeenCalled();
    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['bottom']);
    expect(mockGetScrollContentStyle).toHaveBeenCalledWith({
      includeBottomInset: false,
      paddingBottom: SPACING.md,
      paddingTop: SPACING.md,
    });
    expect(screen.getByText('Power')).toBeTruthy();
    expect(screen.getByText('EKEDC NG')).toBeTruthy();
    expect(screen.getByText(/Ref: VTU-123/)).toBeTruthy();
    expect(screen.getByText(/Cashback:/)).toBeTruthy();
    expect(mockUseVTUHistory).toHaveBeenCalledWith('power', 30);
  });

  it('redirects unauthenticated users to login', () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: '/auth/login?returnTo=%2Futilities%2Fhistory',
    });

    render(<UtilityHistoryScreen />);

    expect(
      screen.getByText('Redirect:/auth/login?returnTo=%2Futilities%2Fhistory')
    ).toBeTruthy();
  });

  it('changes filters when the user taps a chip', () => {
    render(<UtilityHistoryScreen />);

    fireEvent.press(screen.getByLabelText('Show airtime history'));

    expect(mockUseVTUHistory).toHaveBeenLastCalledWith('airtime', 30);
  });

  it('keeps selected filter chip text readable in dark mode', () => {
    mockUseColorScheme.mockReturnValue('dark');

    render(<UtilityHistoryScreen />);

    expect(screen.getByText('Power')).toHaveStyle({
      color: Colors.dark.white,
    });
  });

  it('renders the fetch error state and retries loading history', () => {
    mockUseVTUHistory.mockReturnValue({
      data: [],
      error: new Error('Failed to load utility history.'),
      isLoading: false,
      isRefetching: false,
      refetch: mockRefetch,
    });

    render(<UtilityHistoryScreen />);

    expect(screen.getByText('Unable to load history')).toBeTruthy();

    fireEvent.press(screen.getByText('Try Again'));

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders the empty state when there are no transactions', () => {
    mockUseVTUHistory.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      isRefetching: false,
      refetch: mockRefetch,
    });

    render(<UtilityHistoryScreen />);

    expect(screen.getByText('No history yet')).toBeTruthy();
    expect(
      screen.getByText(
        /Completed utility purchases will appear here once they are available/
      )
    ).toBeTruthy();
  });
});
