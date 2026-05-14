import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { createAuthenticatedFetch } from './authenticated-fetch';
import { parseResponsePayload } from './response-utils';

const GENERATE_DVA_TIMEOUT_MS = 20_000;

export function useGenerateDva() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const response = await createAuthenticatedFetch(
        `${BASE_URL}/api/orders/${orderId}/generate-dva`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
        GENERATE_DVA_TIMEOUT_MS
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

      return response.json() as Promise<{
        existing: boolean;
        success: boolean;
        virtualAccount: {
          account_name: string;
          account_number: string;
          bank_name: string;
        };
      }>;
    },
    mutationKey: ['generateDva'],
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
