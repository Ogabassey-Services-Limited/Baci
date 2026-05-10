import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';

export function useGenerateDva() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);

      try {
        const response = await fetch(
          `${BASE_URL}/api/orders/${orderId}/generate-dva`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            method: 'POST',
            signal: controller.signal,
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

        return response.json() as Promise<{
          existing: boolean;
          success: boolean;
          virtualAccount: {
            account_name: string;
            account_number: string;
            bank_name: string;
          };
        }>;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(
            'DVA generation timed out. Paystack may be slow — try again.'
          );
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    mutationKey: ['generateDva'],
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
