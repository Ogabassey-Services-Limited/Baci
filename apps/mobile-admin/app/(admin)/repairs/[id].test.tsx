import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairBookingDetail } from '@/types/repair-booking';

// Avoid loading the real api-client module (it pulls in expo-constants via
// the Supabase client, which fails under jsdom); mock a lightweight
// NetworkError with the same shape the screen checks via `instanceof`.
vi.mock('@/lib/api-client', () => {
  class NetworkError extends Error {
    statusCode?: number;
    constructor(message: string, options: { statusCode?: number } = {}) {
      super(message);
      this.name = 'NetworkError';
      this.statusCode = options.statusCode;
    }
  }
  return { NetworkError };
});

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  detail: vi.fn(),
  mutate: vi.fn(),
  params: { id: '550e8400-e29b-41d4-a716-446655440000' } as {
    id?: string | string[];
  },
  refetch: vi.fn(),
}));

const booking: RepairBookingDetail = {
  adminNotes: null,
  createdAt: '2026-07-01T09:30:00.000Z',
  customerEmail: 'ada@example.com',
  customerName: 'Ada Lovelace',
  customerPhone: '+2348031234567',
  deviceLabel: 'iPhone 14 Pro Max',
  deviceModel: '14 Pro Max',
  deviceType: 'Smartphone',
  estimatedCost: null,
  id: 'booking-1',
  issueDescription: 'Cracked screen',
  pickupAddress: '12 Marina Road, Lagos',
  preferredDate: null,
  quotedPrice: 45_000,
  quoteId: null,
  repairTypeLabel: 'Screen Replacement',
  serviceType: 'pickup',
  shipmentId: null,
  status: 'pending',
  ticketNumber: 1024,
  trackingNumber: null,
  updatedAt: '2026-07-01T09:30:00.000Z',
};

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
  useLocalSearchParams: () => mocks.params,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#F8FAFC',
      border: '#E2E8F0',
      card: '#FFFFFF',
      error: '#EF4444',
      errorLight: '#FEE2E2',
      gold: '#D4A03D',
      info: '#3B82F6',
      infoLight: '#DBEAFE',
      primary: '#3B82F6',
      primaryLight: '#E3EFFC',
      success: '#22C55E',
      successLight: '#DCFCE7',
      text: '#0F172A',
      textMuted: '#94A3B8',
      textOnGold: '#111827',
      textOnPrimary: '#FFFFFF',
      textSecondary: '#64748B',
      warning: '#F59E0B',
      warningLight: '#FEF3C7',
    },
  }),
}));

vi.mock('@/hooks/useRepairBookingDetail', () => ({
  useRepairBookingDetail: (...args: unknown[]) => mocks.detail(...args),
}));

vi.mock('@/hooks/useUpdateRepairBooking', () => ({
  useUpdateRepairBooking: () => ({
    isPending: false,
    mutate: mocks.mutate,
  }),
}));

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const { Text } = await import('react-native');
  return {
    Ionicons: () => <Text>icon</Text>,
    default: () => <Text>icon</Text>,
    __esModule: true,
  };
});

vi.mock('react-native', () => {
  const MockText = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    Alert: { alert: mocks.alert },
    ActivityIndicator: () => <MockText>loading</MockText>,
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) => (
      <button
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={() => onPress?.()}
        type="button"
      >
        {children}
      </button>
    ),
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: MockText,
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      value?: string;
    }) => (
      <input
        aria-label={accessibilityLabel}
        onChange={(event) => onChangeText?.(event.target.value)}
        value={value ?? ''}
      />
    ),
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

import { NetworkError } from '@/lib/api-client';
import RepairBookingDetailScreen from './[id]';

describe('RepairBookingDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
    mocks.refetch.mockResolvedValue(undefined);
    mocks.detail.mockReturnValue({
      data: { booking },
      error: null,
      isLoading: false,
      refetch: mocks.refetch,
    });
  });

  it('renders the ticket, device, customer, and quote', () => {
    render(<RepairBookingDetailScreen />);

    expect(screen.getByText('#1024')).toBeInTheDocument();
    expect(screen.getByText('iPhone 14 Pro Max')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
  });

  it('shows the pickup address and a dropoff note when applicable', () => {
    render(<RepairBookingDetailScreen />);
    expect(screen.getByText('12 Marina Road, Lagos')).toBeInTheDocument();

    mocks.detail.mockReturnValue({
      data: { booking: { ...booking, serviceType: 'dropoff' } },
      error: null,
      isLoading: false,
      refetch: mocks.refetch,
    });
    render(<RepairBookingDetailScreen />);
    expect(screen.getByText('Dropoff at store')).toBeInTheDocument();
  });

  it('shows an invalid-route screen for a malformed booking id', () => {
    mocks.params = { id: 'not-a-uuid' };

    render(<RepairBookingDetailScreen />);

    expect(screen.getByText('Invalid Booking')).toBeInTheDocument();
    expect(mocks.detail).not.toHaveBeenCalledWith(
      expect.stringContaining('not-a-uuid')
    );
  });

  it('shows a loading indicator while the booking is fetching', () => {
    mocks.detail.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      refetch: mocks.refetch,
    });

    render(<RepairBookingDetailScreen />);

    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('shows a permission-denied message on a 403 response', () => {
    mocks.detail.mockReturnValue({
      data: undefined,
      error: new NetworkError('Permission denied', { statusCode: 403 }),
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingDetailScreen />);

    expect(
      screen.getByText("You don't have permission to view repair bookings.")
    ).toBeInTheDocument();
  });

  it('shows a not-found message on a 404 response', () => {
    mocks.detail.mockReturnValue({
      data: undefined,
      error: new NetworkError('Booking not found', { statusCode: 404 }),
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingDetailScreen />);

    expect(screen.getByText('Booking not found')).toBeInTheDocument();
  });

  it('offers a retry control for a generic load failure', async () => {
    mocks.detail.mockReturnValue({
      data: undefined,
      error: new Error('Network down'),
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingDetailScreen />);
    fireEvent.click(screen.getByText('Tap to retry'));

    await waitFor(() => {
      expect(mocks.refetch).toHaveBeenCalled();
    });
  });

  it('advances the booking status when a next-status action is tapped', () => {
    render(<RepairBookingDetailScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmed' }));

    expect(mocks.mutate).toHaveBeenCalledWith({
      id: 'booking-1',
      status: 'confirmed',
    });
  });

  it('hides status-advance actions for a terminal booking', () => {
    mocks.detail.mockReturnValue({
      data: { booking: { ...booking, status: 'completed' } },
      error: null,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<RepairBookingDetailScreen />);

    expect(screen.queryByText('Advance status')).toBeNull();
  });

  it('saves edited estimated cost and admin notes', () => {
    render(<RepairBookingDetailScreen />);

    fireEvent.change(screen.getByLabelText('Estimated cost'), {
      target: { value: '15000' },
    });
    fireEvent.change(screen.getByLabelText('Admin notes'), {
      target: { value: 'Screen ordered' },
    });
    fireEvent.click(screen.getByText('Save changes'));

    expect(mocks.mutate).toHaveBeenCalledWith({
      id: 'booking-1',
      admin_notes: 'Screen ordered',
      estimated_cost: 15000,
    });
  });

  it('rejects a non-numeric estimated cost instead of clearing the stored value', () => {
    render(<RepairBookingDetailScreen />);

    fireEvent.change(screen.getByLabelText('Estimated cost'), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByText('Save changes'));

    // No mutation (would send estimated_cost: null and wipe a real estimate);
    // the merchant is alerted instead.
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalled();
  });

  it('clears the estimate when the field is emptied', () => {
    render(<RepairBookingDetailScreen />);

    fireEvent.change(screen.getByLabelText('Admin notes'), {
      target: { value: 'note' },
    });
    fireEvent.click(screen.getByText('Save changes'));

    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ estimated_cost: null })
    );
  });

  it('disables Save until a field has actually changed', () => {
    render(<RepairBookingDetailScreen />);

    expect(screen.getByText('Save changes').closest('button')).toBeDisabled();
  });
});
