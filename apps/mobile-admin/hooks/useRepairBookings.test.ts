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
  useInfiniteQuery: vi.fn((config) => config),
}));

import { useInfiniteQuery } from '@tanstack/react-query';
import {
  REPAIR_BOOKINGS_PAGE_SIZE,
  useRepairBookings,
} from './useRepairBookings';

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

  it('scopes the query key to the merchant and status filter, starting at offset 0', () => {
    useRepairBookings('pending');

    expect(vi.mocked(useInfiniteQuery)).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        initialPageParam: 0,
        queryKey: ['repair-bookings', 'merchant-1', 'pending'],
      })
    );
  });

  it('requests the first page for the "all" status with the default limit and offset', async () => {
    mocks.apiClient.mockResolvedValue({ bookings: [], total: 0 });

    const query = useRepairBookings('all') as unknown as {
      queryFn: (input: { pageParam: number }) => Promise<unknown>;
    };
    await query.queryFn({ pageParam: 0 });

    expect(mocks.apiClient).toHaveBeenCalledWith(
      `/api/repairs/bookings?limit=${REPAIR_BOOKINGS_PAGE_SIZE}&offset=0`
    );
  });

  it('appends a status query param for a specific status filter', async () => {
    mocks.apiClient.mockResolvedValue({ bookings: [], total: 0 });

    const query = useRepairBookings('confirmed') as unknown as {
      queryFn: (input: { pageParam: number }) => Promise<unknown>;
    };
    await query.queryFn({ pageParam: 0 });

    expect(mocks.apiClient).toHaveBeenCalledWith(
      `/api/repairs/bookings?status=confirmed&limit=${REPAIR_BOOKINGS_PAGE_SIZE}&offset=0`
    );
  });

  it('requests subsequent pages using the given offset', async () => {
    mocks.apiClient.mockResolvedValue({ bookings: [], total: 60 });

    const query = useRepairBookings('all') as unknown as {
      queryFn: (input: { pageParam: number }) => Promise<unknown>;
    };
    await query.queryFn({ pageParam: REPAIR_BOOKINGS_PAGE_SIZE });

    expect(mocks.apiClient).toHaveBeenCalledWith(
      `/api/repairs/bookings?limit=${REPAIR_BOOKINGS_PAGE_SIZE}&offset=${REPAIR_BOOKINGS_PAGE_SIZE}`
    );
  });

  it('computes the next page offset while more bookings remain', () => {
    const query = useRepairBookings('all') as unknown as {
      getNextPageParam: (
        lastPage: { bookings: unknown[]; total: number },
        allPages: unknown[]
      ) => number | undefined;
    };

    const lastPage = {
      bookings: new Array(REPAIR_BOOKINGS_PAGE_SIZE).fill({}),
      total: 30,
    };
    const nextOffset = query.getNextPageParam(lastPage, [lastPage]);

    expect(nextOffset).toBe(REPAIR_BOOKINGS_PAGE_SIZE);
  });

  it('stops paginating once every booking has been loaded', () => {
    const query = useRepairBookings('all') as unknown as {
      getNextPageParam: (
        lastPage: { bookings: unknown[]; total: number },
        allPages: unknown[]
      ) => number | undefined;
    };

    const firstPage = {
      bookings: new Array(REPAIR_BOOKINGS_PAGE_SIZE).fill({}),
      total: 30,
    };
    const secondPage = { bookings: new Array(5).fill({}), total: 30 };
    const nextOffset = query.getNextPageParam(secondPage, [
      firstPage,
      secondPage,
    ]);

    expect(nextOffset).toBeUndefined();
  });

  it('propagates fetch errors to the caller', async () => {
    mocks.apiClient.mockRejectedValue(new Error('Permission denied'));

    const query = useRepairBookings('all') as unknown as {
      queryFn: (input: { pageParam: number }) => Promise<unknown>;
    };

    await expect(query.queryFn({ pageParam: 0 })).rejects.toThrow(
      'Permission denied'
    );
  });
});
