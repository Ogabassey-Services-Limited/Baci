import { useInfiniteQuery } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { apiClient } from '@/lib/api-client';
import type {
  RepairBookingsListResponse,
  RepairStatus,
} from '@/types/repair-booking';

export type RepairBookingsStatusFilter = RepairStatus | 'all';

/** Matches the web API's default page size (`repairBookingsListQuerySchema`). */
export const REPAIR_BOOKINGS_PAGE_SIZE = 25;

function buildBookingsEndpoint(
  status: RepairBookingsStatusFilter,
  offset: number
): string {
  const statusParam =
    status === 'all' ? '' : `status=${encodeURIComponent(status)}&`;
  return `/api/repairs/bookings?${statusParam}limit=${REPAIR_BOOKINGS_PAGE_SIZE}&offset=${offset}`;
}

/**
 * Dashboard bookings list, scoped to the signed-in merchant and status
 * filter. Paginates via `limit`/`offset` so merchants with more than one
 * page of bookings per status can load the rest (Codex P2).
 */
export function useRepairBookings(status: RepairBookingsStatusFilter) {
  const { merchant } = useMerchant();

  return useInfiniteQuery({
    enabled: !!merchant?.id,
    initialPageParam: 0,
    getNextPageParam: (
      lastPage: RepairBookingsListResponse,
      allPages: RepairBookingsListResponse[]
    ) => {
      const nextOffset = allPages.length * REPAIR_BOOKINGS_PAGE_SIZE;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    queryFn: ({ pageParam }: { pageParam: number }) =>
      apiClient<RepairBookingsListResponse>(
        buildBookingsEndpoint(status, pageParam)
      ),
    queryKey: ['repair-bookings', merchant?.id, status],
    staleTime: 1000 * 60,
  });
}
