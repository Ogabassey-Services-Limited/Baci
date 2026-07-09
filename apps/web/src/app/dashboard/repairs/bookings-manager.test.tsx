import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function booking(id: string, ticketNumber: number) {
  return {
    id,
    ticketNumber,
    status: 'pending',
    deviceLabel: `Smartphone iPhone ${ticketNumber}`,
    deviceType: 'Smartphone',
    deviceModel: `iPhone ${ticketNumber}`,
    repairTypeLabel: null,
    quotedPrice: null,
    estimatedCost: null,
    serviceType: 'dropoff',
    createdAt: '2026-07-01T00:00:00.000Z',
    customerName: 'Ada',
  };
}

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
      bookings: [booking('r-1', 1042)],
      total: 1,
    });

    render(<BookingsManager />);

    expect(await screen.findByText('#1042')).toBeInTheDocument();
    expect(
      screen.getByText('Repair-center pickup address')
    ).toBeInTheDocument();
    expect(mocks.listBookings).toHaveBeenCalledWith({
      status: undefined,
      limit: 25,
      offset: 0,
    });
  });

  it('renders the empty state when there are no bookings', async () => {
    mocks.listBookings.mockResolvedValueOnce({ bookings: [], total: 0 });
    render(<BookingsManager />);
    expect(
      await screen.findByText('No repair bookings yet.')
    ).toBeInTheDocument();
  });

  it('loads additional booking pages', async () => {
    mocks.listBookings
      .mockResolvedValueOnce({
        bookings: Array.from({ length: 25 }, (_, index) =>
          booking(`r-${index + 1}`, 1000 + index)
        ),
        total: 26,
      })
      .mockResolvedValueOnce({
        bookings: [booking('r-26', 1026)],
        total: 26,
      });

    render(<BookingsManager />);

    expect(await screen.findByText('#1000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText('#1026')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /load more/i })
      ).not.toBeInTheDocument()
    );
    expect(mocks.listBookings).toHaveBeenLastCalledWith({
      status: undefined,
      limit: 25,
      offset: 25,
    });
  });
});
