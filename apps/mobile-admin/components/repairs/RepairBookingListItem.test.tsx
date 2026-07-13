import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RepairBookingSummary } from '@/types/repair-booking';

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { RepairBookingListItem } from './RepairBookingListItem';

const colors = {
  border: '#E2E8F0',
  card: '#FFFFFF',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  primary: '#4A90D9',
  primaryLight: '#E3EFFC',
  success: '#22C55E',
  successLight: '#DCFCE7',
  text: '#0F172A',
  textMuted: '#6B7280',
  textSecondary: '#9CA3AF',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
} as unknown as Parameters<typeof RepairBookingListItem>[0]['colors'];

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

describe('RepairBookingListItem', () => {
  it('renders the ticket number, device, service type, and quoted price', () => {
    render(
      <RepairBookingListItem
        booking={booking}
        colors={colors}
        onPress={vi.fn()}
      />
    );

    expect(screen.getByText('#1024')).toBeInTheDocument();
    expect(screen.getByText('iPhone 14 Pro Max')).toBeInTheDocument();
    expect(screen.getByText('Screen Replacement')).toBeInTheDocument();
    expect(screen.getByText('Pickup')).toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows a quote-pending placeholder when no price has been set', () => {
    render(
      <RepairBookingListItem
        booking={{ ...booking, quotedPrice: null }}
        colors={colors}
        onPress={vi.fn()}
      />
    );

    expect(screen.getByText('Quote pending')).toBeInTheDocument();
  });

  it('calls onPress with the booking id when tapped', () => {
    const onPress = vi.fn();
    render(
      <RepairBookingListItem
        booking={booking}
        colors={colors}
        onPress={onPress}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledWith('booking-1');
  });
});
