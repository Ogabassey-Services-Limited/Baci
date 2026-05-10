import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useMerchant } from '../useMerchant';

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
      paymentMethod,
      reference,
      notes,
    }: {
      amount: number;
      notes?: string;
      orderId: string;
      paymentMethod: string;
      reference?: string;
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(
          `${BASE_URL}/api/orders/${orderId}/record-payment`,
          {
            body: JSON.stringify({
              amount,
              notes: notes?.trim() || undefined,
              payment_method: paymentMethod,
              reference: reference?.trim() || undefined,
            }),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            method: 'POST',
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

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
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(
            'Request timed out. Please check your connection and try again.'
          );
        }
        throw error;
      }
    },
    mutationKey: ['recordPayment'],
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats', merchant?.id],
      });
    },
  });
}
