import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RepairBookingSummary } from '@/lib/repairs/booking-mappers';
import { BookingList } from './booking-list';

const bookings: RepairBookingSummary[] = [
  {
    id: 'r-1',
    ticketNumber: 1042,
    status: 'pending',
    deviceLabel: 'Smartphone iPhone 15',
    deviceType: 'Smartphone',
    deviceModel: 'iPhone 15',
    repairTypeLabel: 'Screen Replacement',
    quotedPrice: 45_000,
    estimatedCost: null,
    serviceType: 'pickup',
    createdAt: '2026-07-01T00:00:00.000Z',
    customerName: 'Ada',
  },
];

function renderList(
  overrides: Partial<Parameters<typeof BookingList>[0]> = {}
) {
  const onSelect = vi.fn();
  const onStatusFilterChange = vi.fn();
  render(
    <BookingList
      bookings={bookings}
      loading={false}
      onSelect={onSelect}
      onStatusFilterChange={onStatusFilterChange}
      statusFilter=""
      {...overrides}
    />
  );
  return { onSelect, onStatusFilterChange };
}

describe('BookingList', () => {
  it('renders a booking row with the ticket, device and price', () => {
    renderList();
    expect(screen.getByText('#1042')).toBeInTheDocument();
    expect(screen.getByText('Smartphone iPhone 15')).toBeInTheDocument();
    expect(screen.getByText('₦45,000')).toBeInTheDocument();
  });

  it('calls onSelect when the ticket is clicked', () => {
    const { onSelect } = renderList();
    fireEvent.click(screen.getByRole('button', { name: '#1042' }));
    expect(onSelect).toHaveBeenCalledWith('r-1');
  });

  it('reports status filter changes', () => {
    const { onStatusFilterChange } = renderList();
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'completed' },
    });
    expect(onStatusFilterChange).toHaveBeenCalledWith('completed');
  });

  it('shows an empty state when there are no bookings', () => {
    renderList({ bookings: [] });
    expect(screen.getByText('No repair bookings yet.')).toBeInTheDocument();
  });
});
