import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairBookingDetail } from '@/lib/repairs/booking-mappers';
import { BookingDetail } from './booking-detail';

const mocks = vi.hoisted(() => ({
  getBooking: vi.fn(),
  updateBooking: vi.fn(),
}));

vi.mock('./bookings-api', () => ({
  getBooking: mocks.getBooking,
  updateBooking: mocks.updateBooking,
}));

const detail: RepairBookingDetail = {
  id: 'r-1',
  ticketNumber: 1042,
  status: 'pending',
  deviceLabel: 'Smartphone iPhone 15',
  deviceType: 'Smartphone',
  deviceModel: 'iPhone 15',
  repairTypeLabel: 'Screen Replacement',
  quotedPrice: 45_000,
  estimatedCost: null,
  serviceType: 'dropoff',
  createdAt: '2026-07-01T00:00:00.000Z',
  customerName: 'Ada',
  customerEmail: 'ada@example.com',
  customerPhone: '08012345678',
  issueDescription: 'cracked screen',
  adminNotes: null,
  pickupAddress: null,
  preferredDate: null,
  updatedAt: '2026-07-02T00:00:00.000Z',
  shipmentId: null,
  quoteId: null,
  trackingNumber: null,
};

describe('BookingDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBooking.mockResolvedValue({ booking: detail });
    mocks.updateBooking.mockResolvedValue({ booking: detail });
  });

  it('loads and renders the booking summary', async () => {
    render(<BookingDetail bookingId="r-1" onUpdated={vi.fn()} />);
    expect(await screen.findByText('Ticket #1042')).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
  });

  it('advances the status through the update endpoint', async () => {
    const onUpdated = vi.fn();
    render(<BookingDetail bookingId="r-1" onUpdated={onUpdated} />);
    await screen.findByText('Ticket #1042');

    fireEvent.change(screen.getByLabelText('Advance status'), {
      target: { value: 'confirmed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() =>
      expect(mocks.updateBooking).toHaveBeenCalledWith('r-1', {
        status: 'confirmed',
      })
    );
    expect(onUpdated).toHaveBeenCalled();
  });

  it('saves estimated cost and notes', async () => {
    render(<BookingDetail bookingId="r-1" onUpdated={vi.fn()} />);
    await screen.findByText('Ticket #1042');

    fireEvent.change(screen.getByLabelText('Estimated cost (₦)'), {
      target: { value: '25000' },
    });
    fireEvent.change(screen.getByLabelText('Internal notes'), {
      target: { value: 'diagnosed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() =>
      expect(mocks.updateBooking).toHaveBeenCalledWith('r-1', {
        estimated_cost: 25_000,
        admin_notes: 'diagnosed',
      })
    );
  });

  it('rejects an invalid estimated cost instead of submitting NaN', async () => {
    render(<BookingDetail bookingId="r-1" onUpdated={vi.fn()} />);
    await screen.findByText('Ticket #1042');

    fireEvent.change(screen.getByLabelText('Estimated cost (₦)'), {
      target: { value: 'not-a-number' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(
      screen.getByText('Enter a valid estimated cost.')
    ).toBeInTheDocument();
    expect(mocks.updateBooking).not.toHaveBeenCalled();
  });

  it('disables booking mutation controls for view-only staff', async () => {
    render(
      <BookingDetail bookingId="r-1" canEdit={false} onUpdated={vi.fn()} />
    );
    await screen.findByText('Ticket #1042');

    expect(screen.getByLabelText('Advance status')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
    expect(screen.getByLabelText('Estimated cost (₦)')).toHaveAttribute(
      'readonly'
    );
    expect(screen.getByLabelText('Internal notes')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Save details' })).toBeDisabled();
  });

  it('shows an error when loading fails', async () => {
    mocks.getBooking.mockRejectedValueOnce(new Error('boom'));
    render(<BookingDetail bookingId="r-1" onUpdated={vi.fn()} />);
    expect(
      await screen.findByText('Failed to load booking.')
    ).toBeInTheDocument();
  });
});
