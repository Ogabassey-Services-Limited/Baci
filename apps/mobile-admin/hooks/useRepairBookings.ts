import { useQuery } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { apiClient } from '@/lib/api-client';
import type {
  RepairBookingsListResponse,
  RepairStatus,
} from '@/types/repair-booking';

export type RepairBookingsStatusFilter = RepairStatus | 'all';

function buildBookingsEndpoint(status: RepairBookingsStatusFilter): string {
  if (status === 'all') {
    return '/api/repairs/bookings';
  }
  return `/api/repairs/bookings?status=${encodeURIComponent(status)}`;
}

/** Dashboard bookings list, scoped to the signed-in merchant and status filter. */
export function useRepairBookings(status: RepairBookingsStatusFilter) {
  const { merchant } = useMerchant();

  return useQuery({
    enabled: !!merchant?.id,
    queryFn: () =>
      apiClient<RepairBookingsListResponse>(buildBookingsEndpoint(status)),
    queryKey: ['repair-bookings', merchant?.id, status],
    staleTime: 1000 * 60,
  });
}
