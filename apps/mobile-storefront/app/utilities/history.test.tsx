import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, View } from 'react-native';
import Colors, { SPACING } from '@/constants/Colors';
import UtilityHistoryScreen from './history';

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
const mockPush = jest.fn();
const mockSetClipboardString = jest.fn<(text: string) => Promise<boolean>>();
const mockShareUtilityReceipt = jest.fn<(input: unknown) => Promise<void>>();
const mockConfirmVtuCheckout =
  jest.fn<
    (input: { gateway: 'paystack' | 'korapay'; reference: string }) => Promise<{
      reference: string;
      status: 'processing' | 'successful';
    }>
  >();

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

jest.mock('@/lib/clipboard', () => ({
  setClipboardString: (text: string) => mockSetClipboardString(text),
}));

jest.mock('@/lib/utility-receipt', () => ({
  shareUtilityReceipt: (input: unknown) => mockShareUtilityReceipt(input),
}));

jest.mock('@/lib/vtu-checkout', () => ({
  confirmVtuCheckout: (input: {
    gateway: 'paystack' | 'korapay';
    reference: string;
  }) => mockConfirmVtuCheckout(input),
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
  useRouter: () => ({
    push: mockPush,
  }),
}));

function createFailedSyncHistoryData({
  history = {},
  transaction = {},
}: {
  history?: Record<string, unknown>;
  transaction?: Record<string, unknown>;
} = {}) {
  return {
    data: [
      {
        id: 'tx-2',
        created_at: '2026-04-08T12:00:00.000Z',
        type: 'electricity',
        status: 'failed',
        amount: 2500,
        biller_name: 'EKEDC NG',
        customer_identifier: '1234567890',
        payment_gateway: 'paystack',
        payment_reference: 'VTU-PAYSTACK-123',
        payment_status: 'completed',
        request_reference: 'VTU-123',
        error: null,
        ...transaction,
      },
    ],
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch: mockRefetch,
    ...history,
  };
}

describe('UtilityHistoryScreen', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    mockRefetch.mockResolvedValue(undefined);
    mockSetClipboardString.mockResolvedValue(true);
    mockShareUtilityReceipt.mockResolvedValue(undefined);
    mockConfirmVtuCheckout.mockResolvedValue({
      reference: 'VTU-PAYSTACK-123',
      status: 'successful',
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
          voucher_pin: '1234-5678-9012-3456',
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
    expect(screen.getByText('Voucher / Token')).toBeTruthy();
    expect(screen.getByText('1234-5678-9012-3456')).toBeTruthy();
    expect(screen.getByText(/Cashback:/)).toBeTruthy();
    expect(mockUseVTUHistory).toHaveBeenCalledWith('power', 30);
  });

  it('routes a transaction repeat with the previous bill details', () => {
    render(<UtilityHistoryScreen />);

    fireEvent.press(screen.getByLabelText('Repeat EKEDC NG'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/utilities/[type]',
      params: expect.objectContaining({
        repeatAmount: '2500',
        repeatBillerName: 'EKEDC NG',
        repeatCustomerIdentifier: '1234567890',
        repeatVerified: '1',
        type: 'power',
      }),
    });
  });

  it('copies voucher tokens from history', async () => {
    render(<UtilityHistoryScreen />);

    fireEvent.press(screen.getByLabelText('Copy voucher token'));
    await waitFor(() => {
      expect(mockSetClipboardString).toHaveBeenCalledWith(
        '1234-5678-9012-3456'
      );
    });
  });

  it('shares utility receipts from history', async () => {
    render(<UtilityHistoryScreen />);

    fireEvent.press(screen.getByLabelText('Share receipt for EKEDC NG'));
    await waitFor(() => {
      expect(mockShareUtilityReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2500,
          customerIdentifier: '1234567890',
          reference: 'VTU-123',
          type: 'power',
          voucherPin: '1234-5678-9012-3456',
        })
      );
    });
  });

  it('syncs a failed utility row when the gateway payment reference is available', async () => {
    mockUseVTUHistory.mockReturnValue(createFailedSyncHistoryData());

    render(<UtilityHistoryScreen />);

    expect(screen.getByText('Payment Received')).toBeTruthy();
    expect(
      screen.getByText(/Payment received\. Tap Sync payment/)
    ).toBeTruthy();
    expect(screen.queryByLabelText('Repeat EKEDC NG')).toBeNull();

    fireEvent.press(screen.getByLabelText('Sync payment for EKEDC NG'));

    await waitFor(() => {
      expect(mockConfirmVtuCheckout).toHaveBeenCalledWith({
        gateway: 'paystack',
        reference: 'VTU-PAYSTACK-123',
      });
    });

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('alerts that sync is still processing when fulfillment has not completed', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    mockConfirmVtuCheckout.mockResolvedValue({
      reference: 'VTU-PAYSTACK-123',
      status: 'processing',
    });
    mockUseVTUHistory.mockReturnValue(createFailedSyncHistoryData());

    render(<UtilityHistoryScreen />);

    fireEvent.press(screen.getByLabelText('Sync payment for EKEDC NG'));

    await waitFor(() => {
      expect(mockConfirmVtuCheckout).toHaveBeenCalledWith({
        gateway: 'paystack',
        reference: 'VTU-PAYSTACK-123',
      });
    });
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'Still Processing',
      'The payment is confirmed, but utility fulfillment is still processing.'
    );
  });

  it('alerts when sync payment fails even if history refetch fails', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    mockConfirmVtuCheckout.mockRejectedValue(new Error('Gateway not settled.'));
    mockRefetch.mockRejectedValueOnce(new Error('History refetch failed.'));
    mockUseVTUHistory.mockReturnValue(createFailedSyncHistoryData());

    render(<UtilityHistoryScreen />);

    fireEvent.press(screen.getByLabelText('Sync payment for EKEDC NG'));

    await waitFor(() => {
      expect(mockConfirmVtuCheckout).toHaveBeenCalledWith({
        gateway: 'paystack',
        reference: 'VTU-PAYSTACK-123',
      });
    });
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'Sync Failed',
      'Gateway not settled.'
    );
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
