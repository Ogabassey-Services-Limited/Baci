import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { useMerchant } from '../useMerchant';
import { createAuthenticatedFetch } from './authenticated-fetch';
import { parseResponsePayload } from './response-utils';

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
        const responseText = await response.text();
        const payload = parseResponsePayload(responseText);
        const errorMessage =
          payload &&
          typeof payload === 'object' &&
          typeof payload.error === 'string'
            ? payload.error
            : responseText ||
              `Request failed: ${response.status} ${response.statusText}`;
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
