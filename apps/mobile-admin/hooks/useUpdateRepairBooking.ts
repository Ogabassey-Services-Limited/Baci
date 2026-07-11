import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  RepairBookingDetailResponse,
  RepairStatus,
} from '@/types/repair-booking';

export interface UpdateRepairBookingInput {
  id: string;
  status?: RepairStatus;
  estimated_cost?: number | null;
  admin_notes?: string | null;
}

/**
 * Advances the booking status and/or edits estimated_cost / admin_notes via
 * the dashboard PATCH route. Only the provided fields are sent — the server
 * requires at least one and validates status transitions against the
 * lifecycle (returns 409 on an illegal jump).
 */
export function useUpdateRepairBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: UpdateRepairBookingInput) =>
      apiClient<RepairBookingDetailResponse>(`/api/repairs/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['repair-booking', variables.id], data);
      queryClient.invalidateQueries({ queryKey: ['repair-bookings'] });
    },
  });
}
