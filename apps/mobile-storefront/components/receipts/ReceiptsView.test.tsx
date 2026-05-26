import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps, ReactNode } from 'react';
import Colors from '@/constants/Colors';
import type { ReceiptListItem } from '@/types/receipt';
import { ReceiptsView } from './ReceiptsView';

type ReceiptsViewProps = ComponentProps<typeof ReceiptsView>;

const mockOpenPreview = jest.fn();
const mockPrefetch = jest.fn();
const mockChangeSearch = jest.fn();
const mockClearSearch = jest.fn();
const mockRefresh = jest.fn();
const mockRetry = jest.fn();

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data = [],
    ListEmptyComponent,
    refreshControl,
    renderItem,
  }: {
    data?: ReceiptListItem[];
    ListEmptyComponent?: ReactNode;
    refreshControl?: ReactNode;
    renderItem: ({ item }: { item: ReceiptListItem }) => ReactNode;
  }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <View testID="receipts-list">
        {data.map((item) => (
          <View key={item.id}>{renderItem({ item })}</View>
        ))}
        {data.length === 0 ? ListEmptyComponent : null}
        {refreshControl}
      </View>
    );
  },
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineEmptyState: ({
    title,
    onRetry,
  }: {
    title: string;
    onRetry: () => void;
  }) => {
    const { Pressable, Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable accessibilityLabel="Retry offline receipts" onPress={onRetry}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
  OfflineNotice: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Showing offline receipts</Text>;
  },
}));

jest.mock('./ReceiptCard', () => ({
  ReceiptCard: ({
    item,
    onPrefetch,
    onPress,
  }: {
    item: ReceiptListItem;
    onPrefetch: (orderId: string) => void;
    onPress: (item: ReceiptListItem) => void;
  }) => {
    const { Pressable, Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable
        accessibilityLabel={`Open receipt ${item.order_number}`}
        onPress={() => onPress(item)}
        onPressIn={() => onPrefetch(item.id)}
      >
        <Text>{item.order_number}</Text>
      </Pressable>
    );
  },
}));

jest.mock('./ReceiptsEmptyState', () => ({
  ReceiptsEmptyState: () => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>No rendered receipts</Text>;
  },
}));

jest.mock('./ReceiptPreviewModal', () => ({
  ReceiptPreviewModal: ({ visible }: { visible: boolean }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return visible ? <Text>Receipt preview open</Text> : null;
  },
}));

describe('ReceiptsView', () => {
  const receipt: ReceiptListItem = {
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
  };
  const props: ReceiptsViewProps = {
    colors: Colors.light,
    filteredReceipts: [receipt],
    hasError: false,
    hasReceipts: true,
    isLoading: false,
    isOnline: true,
    isPreviewLoading: false,
    isPreviewOpen: false,
    isReceiptPaid: false,
    isRefreshing: false,
    onChangeSearch: mockChangeSearch,
    onClearSearch: mockClearSearch,
    onClosePreview: jest.fn(),
    onOpenPreview: mockOpenPreview,
    onPrefetch: mockPrefetch,
    onRefresh: mockRefresh,
    onRetry: mockRetry,
    previewHtml: '',
    searchQuery: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders searchable cached receipts and preview interactions', () => {
    render(
      <ReceiptsView
        {...props}
        isOnline={false}
        isPreviewLoading
        isPreviewOpen
        searchQuery="pixel"
      />
    );

    expect(screen.getByText('Showing offline receipts')).toBeOnTheScreen();
    expect(screen.getByText('Loading receipt...')).toBeOnTheScreen();
    expect(screen.getByText('1 receipt found')).toBeOnTheScreen();
    expect(screen.getByText('Receipt preview open')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Search receipts'), 'phone');
    fireEvent.press(screen.getByLabelText('Clear search'));
    fireEvent.press(screen.getByLabelText('Open receipt OG-1001'));

    expect(mockChangeSearch).toHaveBeenCalledWith('phone');
    expect(mockClearSearch).toHaveBeenCalledTimes(1);
    expect(mockOpenPreview).toHaveBeenCalledWith(receipt);
  });

  it('renders loading and offline error states accessibly', () => {
    const { rerender } = render(<ReceiptsView {...props} isLoading />);

    expect(screen.getByLabelText('Loading receipts')).toBeOnTheScreen();

    rerender(
      <ReceiptsView
        {...props}
        filteredReceipts={[]}
        hasError
        hasReceipts={false}
        isOnline={false}
      />
    );

    fireEvent.press(screen.getByLabelText('Retry offline receipts'));

    expect(screen.getByText('Receipts Unavailable')).toBeOnTheScreen();
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the online error retry action', () => {
    render(
      <ReceiptsView
        {...props}
        filteredReceipts={[]}
        hasError
        hasReceipts={false}
      />
    );

    fireEvent.press(screen.getByLabelText('Retry loading receipts'));

    expect(screen.getByText('Failed to load receipts')).toBeOnTheScreen();
    expect(screen.getByText('Tap to retry')).toBeOnTheScreen();
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('uses the active theme tint for the loading indicator', () => {
    const colors = { ...Colors.light, tint: '#0055AA' };

    render(<ReceiptsView {...props} colors={colors} isLoading />);

    expect(screen.getByLabelText('Loading receipts').props.color).toBe(
      colors.tint
    );
  });
});
