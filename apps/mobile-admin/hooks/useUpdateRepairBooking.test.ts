import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: mocks.apiClient,
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn((config) => config),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    setQueryData: mocks.setQueryData,
  }),
}));

import { useUpdateRepairBooking } from './useUpdateRepairBooking';

describe('useUpdateRepairBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCHes only the provided fields to the booking endpoint', async () => {
    mocks.apiClient.mockResolvedValue({
      booking: { id: 'booking-1', status: 'confirmed' },
    });

    const mutation = useUpdateRepairBooking() as unknown as {
      mutationFn: (vars: {
        id: string;
        status?: string;
      }) => Promise<unknown>;
    };

    await mutation.mutationFn({ id: 'booking-1', status: 'confirmed' });

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/repairs/bookings/booking-1',
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'confirmed' }),
      }
    );
  });

  it('sends estimated_cost and admin_notes edits without a status change', async () => {
    mocks.apiClient.mockResolvedValue({
      booking: { id: 'booking-1', estimatedCost: 15000 },
    });

    const mutation = useUpdateRepairBooking() as unknown as {
      mutationFn: (vars: {
        id: string;
        estimated_cost?: number | null;
        admin_notes?: string | null;
      }) => Promise<unknown>;
    };

    await mutation.mutationFn({
      id: 'booking-1',
      estimated_cost: 15000,
      admin_notes: 'Screen ordered',
    });

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/repairs/bookings/booking-1',
      {
        method: 'PATCH',
        body: JSON.stringify({
          estimated_cost: 15000,
          admin_notes: 'Screen ordered',
        }),
      }
    );
  });

  it('caches the updated booking and invalidates the bookings list on success', () => {
    const mutation = useUpdateRepairBooking() as unknown as {
      onSuccess: (
        data: { booking: { id: string } },
        vars: { id: string }
      ) => void;
    };

    mutation.onSuccess(
      { booking: { id: 'booking-1' } },
      { id: 'booking-1' }
    );

    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ['repair-booking', 'booking-1'],
      { booking: { id: 'booking-1' } }
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['repair-bookings'],
    });
  });

  it('propagates a status-transition conflict error to the caller', async () => {
    mocks.apiClient.mockRejectedValue(
      new Error('Cannot change status from completed to pending')
    );

    const mutation = useUpdateRepairBooking() as unknown as {
      mutationFn: (vars: { id: string; status?: string }) => Promise<unknown>;
    };

    await expect(
      mutation.mutationFn({ id: 'booking-1', status: 'pending' })
    ).rejects.toThrow('Cannot change status from completed to pending');
  });
});
