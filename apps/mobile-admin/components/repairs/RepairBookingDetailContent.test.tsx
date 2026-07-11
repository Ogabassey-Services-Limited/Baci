import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RepairBookingDetail } from '@/types/repair-booking';

vi.mock('react-native', () => {
  const MockText = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    Pressable: ({
      children,
      disabled,
      onPress,
    }: {
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) => (
      <button disabled={disabled} onClick={() => onPress?.()} type="button">
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

import { RepairBookingDetailContent } from './RepairBookingDetailContent';

const colors = {
  border: '#E2E8F0',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  primary: '#3B82F6',
  primaryLight: '#E3EFFC',
  success: '#22C55E',
  successLight: '#DCFCE7',
  text: '#0F172A',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  textSecondary: '#64748B',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
} as unknown as Parameters<typeof RepairBookingDetailContent>[0]['colors'];

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

const baseProps = {
  adminNotesInput: '',
  allowedNextStatuses: ['confirmed', 'in_progress', 'rejected', 'cancelled'] as const,
  booking,
  colors,
  estimatedCostInput: '',
  isDirty: false,
  isSaving: false,
  onAdminNotesChange: vi.fn(),
  onAdvanceStatus: vi.fn(),
  onEstimatedCostChange: vi.fn(),
  onSaveDetails: vi.fn(),
};

describe('RepairBookingDetailContent', () => {
  it('renders the ticket, device, customer, and quote', () => {
    render(<RepairBookingDetailContent {...baseProps} />);

    expect(screen.getByText('#1024')).toBeInTheDocument();
    expect(screen.getByText('iPhone 14 Pro Max')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
  });

  it('shows the pickup address for pickup bookings', () => {
    render(<RepairBookingDetailContent {...baseProps} />);

    expect(screen.getByText('12 Marina Road, Lagos')).toBeInTheDocument();
  });

  it('shows a dropoff note for dropoff bookings', () => {
    render(
      <RepairBookingDetailContent
        {...baseProps}
        booking={{ ...booking, serviceType: 'dropoff' }}
      />
    );

    expect(screen.getByText('Dropoff at store')).toBeInTheDocument();
  });

  it('disables Save until a field is dirty', () => {
    render(<RepairBookingDetailContent {...baseProps} isDirty={false} />);

    expect(screen.getByText('Save changes').closest('button')).toBeDisabled();
  });

  it('calls onSaveDetails when Save is tapped while dirty', () => {
    const onSaveDetails = vi.fn();
    render(
      <RepairBookingDetailContent
        {...baseProps}
        isDirty
        onSaveDetails={onSaveDetails}
      />
    );

    fireEvent.click(screen.getByText('Save changes'));

    expect(onSaveDetails).toHaveBeenCalled();
  });

  it('forwards edits to the estimated cost and admin notes inputs', () => {
    const onEstimatedCostChange = vi.fn();
    const onAdminNotesChange = vi.fn();
    render(
      <RepairBookingDetailContent
        {...baseProps}
        onAdminNotesChange={onAdminNotesChange}
        onEstimatedCostChange={onEstimatedCostChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Estimated cost'), {
      target: { value: '15000' },
    });
    fireEvent.change(screen.getByLabelText('Admin notes'), {
      target: { value: 'Screen ordered' },
    });

    expect(onEstimatedCostChange).toHaveBeenCalledWith('15000');
    expect(onAdminNotesChange).toHaveBeenCalledWith('Screen ordered');
  });

  it('renders a button per allowed next status and reports taps', () => {
    const onAdvanceStatus = vi.fn();
    render(
      <RepairBookingDetailContent
        {...baseProps}
        onAdvanceStatus={onAdvanceStatus}
      />
    );

    fireEvent.click(screen.getByText('Confirmed'));

    expect(onAdvanceStatus).toHaveBeenCalledWith('confirmed');
  });

  it('hides the advance-status section for a terminal booking', () => {
    render(
      <RepairBookingDetailContent {...baseProps} allowedNextStatuses={[]} />
    );

    expect(screen.queryByText('Advance status')).toBeNull();
  });
});
