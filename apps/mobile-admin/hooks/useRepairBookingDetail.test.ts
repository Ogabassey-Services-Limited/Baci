import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: mocks.apiClient,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((config) => config),
}));

import { useQuery } from '@tanstack/react-query';
import { useRepairBookingDetail } from './useRepairBookingDetail';

describe('useRepairBookingDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when no id is provided', () => {
    const query = useRepairBookingDetail(undefined) as unknown as {
      enabled: boolean;
    };

    expect(query.enabled).toBe(false);
  });

  it('is enabled once an id is provided and scopes the query key to it', () => {
    useRepairBookingDetail('booking-1');

    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        queryKey: ['repair-booking', 'booking-1'],
      })
    );
  });

  it('fetches the booking detail endpoint', async () => {
    mocks.apiClient.mockResolvedValue({
      booking: { id: 'booking-1', ticketNumber: 42 },
    });

    const query = useRepairBookingDetail('booking-1') as unknown as {
      queryFn: () => Promise<unknown>;
    };
    const result = await query.queryFn();

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/repairs/bookings/booking-1'
    );
    expect(result).toEqual({
      booking: { id: 'booking-1', ticketNumber: 42 },
    });
  });

  it('propagates a permission-denied error to the caller', async () => {
    mocks.apiClient.mockRejectedValue(new Error('Permission denied'));

    const query = useRepairBookingDetail('booking-1') as unknown as {
      queryFn: () => Promise<unknown>;
    };

    await expect(query.queryFn()).rejects.toThrow('Permission denied');
  });
});
