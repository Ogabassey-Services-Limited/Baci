import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listBookings: vi.fn(),
  getRepairSettings: vi.fn(),
}));

vi.mock('./bookings-api', () => ({
  listBookings: mocks.listBookings,
  getRepairSettings: mocks.getRepairSettings,
}));

const { default: BookingsManager } = await import('./bookings-manager');

describe('BookingsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRepairSettings.mockResolvedValue({
      repairSettings: null,
      repairsCatalogEnabled: true,
    });
  });

  it('loads and lists bookings', async () => {
    mocks.listBookings.mockResolvedValueOnce({
      bookings: [
        {
          id: 'r-1',
          ticketNumber: 1042,
          status: 'pending',
          deviceLabel: 'Smartphone iPhone 15',
          deviceType: 'Smartphone',
          deviceModel: 'iPhone 15',
          repairTypeLabel: null,
          quotedPrice: null,
          estimatedCost: null,
          serviceType: 'dropoff',
          createdAt: '2026-07-01T00:00:00.000Z',
          customerName: 'Ada',
        },
      ],
      total: 1,
    });

    render(<BookingsManager />);

    expect(await screen.findByText('#1042')).toBeInTheDocument();
    expect(
      screen.getByText('Repair-center pickup address')
    ).toBeInTheDocument();
    expect(mocks.listBookings).toHaveBeenCalledWith({ status: undefined });
  });

  it('renders the empty state when there are no bookings', async () => {
    mocks.listBookings.mockResolvedValueOnce({ bookings: [], total: 0 });
    render(<BookingsManager />);
    expect(
      await screen.findByText('No repair bookings yet.')
    ).toBeInTheDocument();
  });
});
