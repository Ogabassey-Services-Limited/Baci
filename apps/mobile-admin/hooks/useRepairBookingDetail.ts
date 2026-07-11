import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { RepairBookingDetailResponse } from '@/types/repair-booking';

/** Single repair booking, including customer contact and pickup details. */
export function useRepairBookingDetail(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryFn: () =>
      apiClient<RepairBookingDetailResponse>(`/api/repairs/bookings/${id}`),
    queryKey: ['repair-booking', id],
    staleTime: 1000 * 30,
  });
}
