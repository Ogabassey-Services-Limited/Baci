import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';

export function useSendReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      channel = 'email',
      message = '',
    }: {
      channel?: 'email' | 'sms' | 'whatsapp';
      message?: string;
      orderId: string;
    }) => {
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

      const response = await fetch(
        `${BASE_URL}/api/orders/${orderId}/reminder`,
        {
          body: JSON.stringify({ channel, message }),
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
          const error = await response.json();
          if (error.error) {
            errorMessage = error.error;
          }
        } catch {
          // noop
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    mutationKey: ['sendReminder'],
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
