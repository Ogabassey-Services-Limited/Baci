import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { useMerchant } from '../useMerchant';
import { createAuthenticatedFetch } from './authenticated-fetch';

const RECORD_PAYMENT_TIMEOUT_MS = 15_000;

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
      const response = await createAuthenticatedFetch(
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
          },
          method: 'POST',
        },
        RECORD_PAYMENT_TIMEOUT_MS
      );

      if (!response.ok) {
        let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        try {
          const errorBody: unknown = await response.json();
          if (
            typeof errorBody === 'object' &&
            errorBody !== null &&
            'error' in errorBody &&
            typeof errorBody.error === 'string'
          ) {
            errorMessage = errorBody.error;
          }
        } catch {
          // noop
        }
        throw new Error(errorMessage);
      }

      return response.json();
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
