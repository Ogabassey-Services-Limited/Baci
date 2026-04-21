import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, View, type ViewProps } from 'react-native';
import ReceiptsScreen from './index';

const mockReactActual = jest.requireActual('react') as typeof import('react');
const mockReactNativeActual = jest.requireActual(
  'react-native'
) as typeof import('react-native');

interface MockFlashListProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

type MockListStyleOptions = {
  includeBottomInset?: boolean;
};

interface MockShellProps extends React.PropsWithChildren<ViewProps> {
  edges?: readonly string[];
}

const mockFlashList = jest.fn(({ children, ...props }: MockFlashListProps) => (
  <View testID="receipts-flash-list" {...props}>
    {children}
  </View>
));
const mockStorefrontScreenShell = jest.fn(
  ({ children, ...props }: MockShellProps) => (
    <View testID="storefront-screen-shell" {...props}>
      {children}
    </View>
  )
);
const mockGetListContentStyle =
  jest.fn<
    (options?: MockListStyleOptions) => {
      gap: number;
      padding: number;
      paddingBottom: number;
    }
  >();
const mockUseStorefrontInsets = jest.fn();
const mockUseReceipts = jest.fn();
const mockUseRequireAuth = jest.fn();
const mockUseNetworkState = jest.fn();
const mockUseReceiptPreview = jest.fn();
const mockUseQueryClient = jest.fn();
const mockReceiptCard = jest.fn(({ item }: { item: { id: string } }) => (
  <View testID={`receipt-card-${item.id}`} />
));
const mockReceiptPreviewModal = jest.fn((_: Record<string, unknown>) => (
  <View testID="receipt-modal" />
));
const mockOfflineNotice = jest.fn((_: Record<string, unknown>) => (
  <View testID="offline-notice" />
));
const mockReceiptsEmptyState = jest.fn((_: Record<string, unknown>) => (
  <View testID="receipts-empty" />
));
const mockOfflineEmptyState = jest.fn((_: Record<string, unknown>) => (
  <View testID="offline-empty" />
));
const mockRedirect = jest.fn(({ href }: { href: string }) => (
  <View testID="receipts-redirect" accessibilityLabel={href} />
));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => mockRedirect({ href }),
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data = [],
    renderItem,
    ListEmptyComponent,
    children,
    ...props
  }: {
    data?: Array<{ id: string }>;
    children?: React.ReactNode;
    renderItem?: (info: {
      item: { id: string };
      index: number;
    }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode | (() => React.ReactNode);
  }) => {
    const renderedContent =
      data.length === 0
        ? typeof ListEmptyComponent === 'function'
          ? ListEmptyComponent()
          : ListEmptyComponent
        : data.map((item, index) =>
            mockReactActual.createElement(
              mockReactNativeActual.View,
              { key: item.id },
              renderItem ? renderItem({ item, index }) : null
            )
          );

    return mockFlashList({
      children: renderedContent ?? children,
      ...props,
      data,
      renderItem,
      ListEmptyComponent,
    });
  },
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
  }) => mockStorefrontScreenShell({ children, ...props }),
}));

jest.mock('@/hooks/use-storefront-insets', () => ({
  useStorefrontInsets: () => mockUseStorefrontInsets(),
}));

jest.mock('@/hooks/use-receipts', () => ({
  receiptDetailQueryOptions: (orderId: string) => ({ orderId }),
  useReceipts: () => mockUseReceipts(),
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

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockUseQueryClient(),
}));

jest.mock('@/components/receipts/ReceiptCard', () => ({
  getPaymentConfig: (status: string) =>
    status === 'paid'
      ? { label: 'Receipt', color: '#059669', icon: 'checkmark-circle' }
      : { label: 'Invoice', color: '#DC2626', icon: 'document-text' },
  ReceiptCard: ({ item }: { item: { id: string } }) =>
    mockReceiptCard({ item }),
}));

jest.mock('@/components/receipts/ReceiptPreviewModal', () => ({
  ReceiptPreviewModal: (props: Record<string, unknown>) =>
    mockReceiptPreviewModal(props),
}));

jest.mock('@/components/receipts/ReceiptsEmptyState', () => ({
  ReceiptsEmptyState: (props: Record<string, unknown>) =>
    mockReceiptsEmptyState(props),
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineNotice: (props: Record<string, unknown>) => mockOfflineNotice(props),
  OfflineEmptyState: (props: Record<string, unknown>) =>
    mockOfflineEmptyState(props),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('ReceiptsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetListContentStyle.mockImplementation(
      (options?: MockListStyleOptions) => ({
        padding: 16,
        gap: 12,
        paddingBottom: options?.includeBottomInset === false ? 16 : 50,
      })
    );
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: jest.fn(),
      getListContentStyle: mockGetListContentStyle,
    });
    mockUseReceipts.mockReturnValue({
      data: [
        {
          id: 'receipt-1',
          order_number: '1001',
          payment_status: 'paid',
          items: [{ product_name: 'Sneakers' }],
        },
        {
          id: 'receipt-2',
          order_number: '1002',
          payment_status: 'unpaid',
          items: [{ product_name: 'Jacket' }],
        },
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(async () => undefined),
    });
    mockUseRequireAuth.mockReturnValue({
      redirectTo: null,
      user: { id: 'customer-1' },
      isLoading: false,
    });
    mockUseNetworkState.mockReturnValue({
      isOnline: true,
    });
    mockUseReceiptPreview.mockReturnValue({
      isLoading: false,
      isOpen: false,
      html: '',
      isPaid: false,
      openPreview: jest.fn(),
      closePreview: jest.fn(),
    });
    mockUseQueryClient.mockReturnValue({
      prefetchQuery: jest.fn(),
    });
  });

  it('uses the storefront shell with bottom safe-area ownership', () => {
    render(<ReceiptsScreen />);

    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['bottom']);
  });

  it('uses the list padding helper for the receipts list content', () => {
    render(<ReceiptsScreen />);

    const flashListProps = mockFlashList.mock.calls[0]?.[0];

    expect(mockGetListContentStyle).toHaveBeenCalledWith({
      includeBottomInset: false,
    });
    expect(StyleSheet.flatten(flashListProps?.contentContainerStyle)).toEqual({
      padding: 16,
      gap: 12,
      paddingBottom: 16,
    });
  });

  it('keeps the empty-state layout centered when search filtering removes all receipts', () => {
    render(<ReceiptsScreen />);

    fireEvent.changeText(screen.getByLabelText('Search receipts'), 'missing');

    const flashListProps = mockFlashList.mock.calls.at(-1)?.[0];

    expect(StyleSheet.flatten(flashListProps?.contentContainerStyle)).toEqual({
      flex: 1,
      gap: 12,
      padding: 16,
      paddingBottom: 16,
    });
  });

  it('filters the rendered receipts by search text', () => {
    render(<ReceiptsScreen />);

    expect(screen.getByTestId('receipt-card-receipt-1')).toBeTruthy();
    expect(screen.getByTestId('receipt-card-receipt-2')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Search receipts'), 'invoice');

    expect(screen.getByText('1 receipt found')).toBeTruthy();
    expect(screen.queryByTestId('receipt-card-receipt-1')).toBeNull();
    expect(screen.getByTestId('receipt-card-receipt-2')).toBeTruthy();
  });

  it('redirects when the auth guard returns a destination', () => {
    mockUseRequireAuth.mockReturnValue({
      redirectTo: '/auth/login?returnTo=%2Freceipts',
      user: null,
      isLoading: false,
    });

    render(<ReceiptsScreen />);

    expect(mockRedirect).toHaveBeenCalledWith({
      href: '/auth/login?returnTo=%2Freceipts',
    });
    expect(
      screen.getByTestId('receipts-redirect').props.accessibilityLabel
    ).toBe('/auth/login?returnTo=%2Freceipts');
  });

  it('renders the offline empty state when receipt loading fails without a network connection', () => {
    mockUseReceipts.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('offline'),
      refetch: jest.fn(async () => undefined),
    });
    mockUseNetworkState.mockReturnValue({
      isOnline: false,
    });

    render(<ReceiptsScreen />);

    expect(screen.getByTestId('offline-empty')).toBeTruthy();
  });
});
