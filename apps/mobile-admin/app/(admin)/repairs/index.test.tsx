import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairBookingSummary } from '@/types/repair-booking';

const mocks = vi.hoisted(() => ({
  fetchNextPage: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  useRepairBookings: vi.fn(),
}));

const booking: RepairBookingSummary = {
  createdAt: '2026-07-01T09:30:00.000Z',
  customerName: 'Ada Lovelace',
  deviceLabel: 'iPhone 14 Pro Max',
  deviceModel: '14 Pro Max',
  deviceType: 'Smartphone',
  estimatedCost: null,
  id: 'booking-1',
  quotedPrice: 45_000,
  repairTypeLabel: 'Screen Replacement',
  serviceType: 'pickup',
  status: 'pending',
  ticketNumber: 1024,
};

const secondBooking: RepairBookingSummary = {
  ...booking,
  id: 'booking-2',
  ticketNumber: 1025,
};

vi.mock('expo-router', () => ({
  router: { push: mocks.push },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#F8FAFC',
      border: '#E2E8F0',
      card: '#FFFFFF',
      error: '#EF4444',
      gold: '#D4A03D',
      primary: '#3B82F6',
      text: '#0F172A',
      textMuted: '#94A3B8',
      textOnGold: '#111827',
      textSecondary: '#64748B',
    },
  }),
}));

vi.mock('@/hooks/useRepairBookings', () => ({
  useRepairBookings: (...args: unknown[]) => mocks.useRepairBookings(...args),
}));

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const { Text } = await import('react-native');
  return {
    Ionicons: () => <Text>icon</Text>,
    default: () => <Text>icon</Text>,
    __esModule: true,
  };
});

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data = [],
    keyExtractor,
    ListEmptyComponent,
    ListFooterComponent,
    onEndReached,
    renderItem,
  }: {
    data?: unknown[];
    keyExtractor?: (item: unknown, index: number) => string;
    ListEmptyComponent?: ReactNode;
    ListFooterComponent?: ReactNode;
    onEndReached?: () => void;
    renderItem: (input: { index: number; item: unknown }) => ReactNode;
  }) => (
    <div>
      {data.length === 0 ? (
        ListEmptyComponent
      ) : (
        <ul aria-label="repair-bookings-list">
          {data.map((item, index) => (
            <li key={keyExtractor?.(item, index) ?? index}>
              {renderItem({ item, index })}
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => onEndReached?.()} type="button">
        load-more
      </button>
      {ListFooterComponent}
    </div>
  ),
}));

vi.mock('react-native', () => {
  const MockText = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    ActivityIndicator: () => <MockText>loading</MockText>,
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { selected?: boolean };
      children?: ReactNode;
      onPress?: () => void;
    }) => (
      <button
        aria-label={accessibilityLabel}
        aria-pressed={accessibilityState?.selected ?? false}
        onClick={() => onPress?.()}
        type="button"
      >
        {children}
      </button>
    ),
    RefreshControl: () => null,
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: MockText,
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

import RepairBookingsScreen from './index';

describe('RepairBookingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refetch.mockResolvedValue(undefined);
    mocks.useRepairBookings.mockReturnValue({
      data: { pages: [{ bookings: [booking], total: 1 }] },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mocks.refetch,
    });
  });

  it('renders bookings with ticket number, device, and price', async () => {
    render(<RepairBookingsScreen />);

    expect(await screen.findByText('#1024')).toBeInTheDocument();
    expect(screen.getByText('iPhone 14 Pro Max')).toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
  });

  it('navigates to the booking detail screen on tap', async () => {
    render(<RepairBookingsScreen />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Booking #1024, iPhone 14 Pro Max',
      })
    );

    expect(mocks.push).toHaveBeenCalledWith('/(admin)/repairs/booking-1');
  });

  it('shows an empty state when there are no bookings', async () => {
    mocks.useRepairBookings.mockReturnValue({
      data: { pages: [{ bookings: [], total: 0 }] },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingsScreen />);

    expect(
      await screen.findByText('No repair bookings yet')
    ).toBeInTheDocument();
  });

  it('shows a loading indicator while the first page is fetching', () => {
    mocks.useRepairBookings.mockReturnValue({
      data: undefined,
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      refetch: mocks.refetch,
    });

    render(<RepairBookingsScreen />);

    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('shows a retry control when loading bookings fails', async () => {
    mocks.useRepairBookings.mockReturnValue({
      data: undefined,
      error: new Error('Network down'),
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingsScreen />);

    fireEvent.click(await screen.findByText('Tap to retry'));

    await waitFor(() => {
      expect(mocks.refetch).toHaveBeenCalled();
    });
  });

  it('switches the status filter and refetches the scoped list', async () => {
    render(<RepairBookingsScreen />);

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmed' }));

    await waitFor(() => {
      expect(mocks.useRepairBookings).toHaveBeenLastCalledWith('confirmed');
    });
  });

  it('renders bookings accumulated across multiple loaded pages', async () => {
    mocks.useRepairBookings.mockReturnValue({
      data: {
        pages: [
          { bookings: [booking], total: 2 },
          { bookings: [secondBooking], total: 2 },
        ],
      },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingsScreen />);

    expect(await screen.findByText('#1024')).toBeInTheDocument();
    expect(screen.getByText('#1025')).toBeInTheDocument();
  });

  it('fetches the next page when the list end is reached and more pages exist', async () => {
    mocks.useRepairBookings.mockReturnValue({
      data: { pages: [{ bookings: [booking], total: 2 }] },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingsScreen />);

    fireEvent.click(await screen.findByRole('button', { name: 'load-more' }));

    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not fetch another page while one is already in flight', async () => {
    mocks.useRepairBookings.mockReturnValue({
      data: { pages: [{ bookings: [booking], total: 2 }] },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: true,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingsScreen />);

    fireEvent.click(await screen.findByRole('button', { name: 'load-more' }));

    expect(mocks.fetchNextPage).not.toHaveBeenCalled();
  });

  it('does not fetch another page once every booking has been loaded', async () => {
    mocks.useRepairBookings.mockReturnValue({
      data: { pages: [{ bookings: [booking], total: 1 }] },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingsScreen />);

    fireEvent.click(await screen.findByRole('button', { name: 'load-more' }));

    expect(mocks.fetchNextPage).not.toHaveBeenCalled();
  });

  it('shows a footer loading indicator while fetching the next page', async () => {
    mocks.useRepairBookings.mockReturnValue({
      data: { pages: [{ bookings: [booking], total: 2 }] },
      error: null,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: true,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingsScreen />);

    expect(await screen.findByText('loading')).toBeInTheDocument();
  });
});
