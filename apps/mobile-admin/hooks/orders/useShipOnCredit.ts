import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useMerchant } from '../useMerchant';

export function useShipOnCredit() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({
      orderId,
      creditNotes,
    }: {
      creditNotes?: string;
      orderId: string;
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${BASE_URL}/api/orders/${orderId}/ship-on-credit`,
        {
          body: JSON.stringify({ credit_notes: creditNotes }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          method: 'POST',
        }
      );

      if (!response.ok) {
        let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        try {
          const errorBody = await response.json();
          if (errorBody.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // noop
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    mutationKey: ['shipOnCredit'],
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
    },
  });
}
