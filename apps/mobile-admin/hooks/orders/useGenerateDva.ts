import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { createAuthenticatedFetch } from './authenticated-fetch';

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
