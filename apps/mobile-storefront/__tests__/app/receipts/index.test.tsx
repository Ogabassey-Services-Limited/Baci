import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, View } from 'react-native';
import ReceiptsScreen from '@/app/receipts';
import type { ReceiptListItem } from '@/types/receipt';

type ShellProps = {
  children?: ReactNode;
  edges?: readonly string[];
};

type ViewProps = {
  filteredReceipts: ReceiptListItem[];
  hasError: boolean;
  isLoading: boolean;
  isOnline: boolean;
  onChangeSearch: (value: string) => void;
  onPrefetch: (orderId: string) => void;
};

const mockRedirect = jest.fn(({ href }: { href: string }) => (
  <View testID="receipts-redirect" accessibilityLabel={href} />
));
const mockReplace = jest.fn();
let mockSearchParams: { receiptClaimed?: string } = {};
const mockScreenShell = jest.fn();
const mockReceiptsView = jest.fn<(props: ViewProps) => ReactNode>();
const mockPrefetchQuery = jest.fn();
const mockUseRequireAuth = jest.fn();
const mockUseNetworkState = jest.fn();
const mockUseReceiptPreview = jest.fn();
const mockUseReceipts = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => mockRedirect({ href }),
  router: {
    replace: (...args: Parameters<typeof mockReplace>) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({ children, ...props }: ShellProps) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    mockScreenShell(props);
    return <View testID="storefront-screen-shell">{children}</View>;
  },
}));

jest.mock('@/components/receipts/ReceiptsView', () => ({
  ReceiptsView: (props: ViewProps) => mockReceiptsView(props),
}));

// Render the Devices page directly so this screen test stays focused on the
// Devices receipts flow (the tabs/pager + Utilities list are tested separately).
jest.mock('@/components/receipts/ReceiptsTabs', () => ({
  ReceiptsTabs: ({ devicesContent }: { devicesContent: ReactNode }) =>
    devicesContent,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ prefetchQuery: mockPrefetchQuery }),
}));

jest.mock('@/hooks/use-auth-guard', () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

jest.mock('@/hooks/use-network-state', () => ({
  useNetworkState: () => mockUseNetworkState(),
}));

jest.mock('@/hooks/use-receipt-preview', () => ({
  useReceiptPreview: () => mockUseReceiptPreview(),
}));

jest.mock('@/hooks/use-receipts', () => ({
  receiptDetailQueryOptions: (orderId: string) => ({
    queryKey: ['receipt-detail', orderId],
  }),
  useReceipts: () => mockUseReceipts(),
}));

describe('ReceiptsScreen', () => {
  const receipts: ReceiptListItem[] = [
    {
      amount_paid: 95000,
      created_at: '2026-05-24T10:00:00.000Z',
      currency: 'NGN',
      id: 'order-1',
      items: [
        {
          id: 'item-1',
          price: 95000,
          product_name: 'Pixel 9',
          quantity: 1,
        },
      ],
      order_number: 'OG-1001',
      payment_status: 'paid',
      total: 95000,
    },
    {
      amount_paid: 0,
      created_at: '2026-05-23T10:00:00.000Z',
      currency: 'NGN',
      id: 'order-2',
      items: [
        {
          id: 'item-2',
          price: 20000,
          product_name: 'Charger',
          quantity: 1,
        },
      ],
      order_number: 'OG-1002',
      payment_status: 'unpaid',
      total: 20000,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockReceiptsView.mockImplementation(() => <View testID="receipts-view" />);
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
      user: { id: 'customer-1' },
    });
    mockUseNetworkState.mockReturnValue({ isOnline: true });
    mockUseReceiptPreview.mockReturnValue({
      closePreview: jest.fn(),
      html: '',
      isLoading: false,
      isOpen: false,
      isPaid: false,
      openPreview: jest.fn(),
    });
    mockUseReceipts.mockReturnValue({
      data: receipts,
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  it('renders in the storefront shell and controls receipt filtering and prefetching', () => {
    render(<ReceiptsScreen />);

    expect(mockScreenShell).toHaveBeenCalledWith(
      expect.objectContaining({ edges: ['bottom'] })
    );

    const initialViewProps = mockReceiptsView.mock.calls[0]?.[0];
    expect(initialViewProps?.filteredReceipts).toHaveLength(2);

    act(() => {
      initialViewProps?.onChangeSearch('pixel');
    });

    const filteredViewProps = mockReceiptsView.mock.calls.at(-1)?.[0];
    expect(filteredViewProps?.filteredReceipts).toEqual([receipts[0]]);

    filteredViewProps?.onPrefetch('order-1');
    expect(mockPrefetchQuery).toHaveBeenCalledWith({
      queryKey: ['receipt-detail', 'order-1'],
    });
  });

  it('redirects unauthenticated customers without rendering the shell', () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: '/auth/login?returnTo=%2Freceipts',
      user: null,
    });

    render(<ReceiptsScreen />);

    expect(
      screen.getByLabelText('/auth/login?returnTo=%2Freceipts')
    ).toBeOnTheScreen();
    expect(mockScreenShell).not.toHaveBeenCalled();
  });

  it('shows a receipt-ready prompt after returning from a claim', () => {
    mockSearchParams = { receiptClaimed: '1' };

    render(<ReceiptsScreen />);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Receipts ready',
      'Your imported receipts are now available in Ogabassey.',
      [
        {
          onPress: expect.any(Function),
          text: 'View receipts',
        },
      ],
      { cancelable: false }
    );

    const actions = (Alert.alert as jest.Mock).mock.calls[0]?.[2] as Array<{
      onPress?: () => void;
    }>;
    actions[0]?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith('/receipts');
  });

  it('shows the receipt-ready prompt once when auth state bounces', () => {
    mockSearchParams = { receiptClaimed: '1' };
    mockUseRequireAuth.mockReturnValue({
      isLoading: true,
      redirectTo: null,
      user: { id: 'customer-1' },
    });

    const { rerender } = render(<ReceiptsScreen />);

    expect(Alert.alert).not.toHaveBeenCalled();

    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
      user: { id: 'customer-1' },
    });
    rerender(<ReceiptsScreen />);

    mockUseRequireAuth.mockReturnValue({
      isLoading: true,
      redirectTo: null,
      user: { id: 'customer-1' },
    });
    rerender(<ReceiptsScreen />);

    mockUseRequireAuth.mockReturnValue({
      isLoading: false,
      redirectTo: null,
      user: { id: 'customer-1' },
    });
    rerender(<ReceiptsScreen />);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('passes loading, error, and network state through to the view', () => {
    mockUseRequireAuth.mockReturnValue({
      isLoading: true,
      redirectTo: null,
      user: { id: 'customer-1' },
    });
    mockUseNetworkState.mockReturnValue({ isOnline: false });
    mockUseReceipts.mockReturnValue({
      data: null,
      error: new Error('receipt load failed'),
      isLoading: false,
      refetch: jest.fn(),
    });

    render(<ReceiptsScreen />);

    const viewProps = mockReceiptsView.mock.calls[0]?.[0];
    expect(viewProps?.hasError).toBe(true);
    expect(viewProps?.isLoading).toBe(true);
    expect(viewProps?.isOnline).toBe(false);
  });
});
