import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
  merchant: { id: 'merchant-1' } as { id: string } | null,
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: mocks.apiClient,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((config) => config),
}));

import { useQuery } from '@tanstack/react-query';
import { useRepairBookings } from './useRepairBookings';

describe('useRepairBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.merchant = { id: 'merchant-1' };
  });

  it('is disabled until a merchant id is available', () => {
    mocks.merchant = null;

    const query = useRepairBookings('all') as unknown as { enabled: boolean };

    expect(query.enabled).toBe(false);
  });

  it('scopes the query key to the merchant and status filter', () => {
    useRepairBookings('pending');

    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        queryKey: ['repair-bookings', 'merchant-1', 'pending'],
      })
    );
  });

  it('requests the unfiltered endpoint for the "all" status', async () => {
    mocks.apiClient.mockResolvedValue({ bookings: [], total: 0 });

    const query = useRepairBookings('all') as unknown as {
      queryFn: () => Promise<unknown>;
    };
    await query.queryFn();

    expect(mocks.apiClient).toHaveBeenCalledWith('/api/repairs/bookings');
  });

  it('appends a status query param for a specific status filter', async () => {
    mocks.apiClient.mockResolvedValue({ bookings: [], total: 0 });

    const query = useRepairBookings('confirmed') as unknown as {
      queryFn: () => Promise<unknown>;
    };
    await query.queryFn();

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/repairs/bookings?status=confirmed'
    );
  });

  it('propagates fetch errors to the caller', async () => {
    mocks.apiClient.mockRejectedValue(new Error('Permission denied'));

    const query = useRepairBookings('all') as unknown as {
      queryFn: () => Promise<unknown>;
    };

    await expect(query.queryFn()).rejects.toThrow('Permission denied');
  });
});
