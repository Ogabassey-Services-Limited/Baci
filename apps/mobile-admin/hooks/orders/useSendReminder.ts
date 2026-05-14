import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { createAuthenticatedFetch } from './authenticated-fetch';
import { parseResponsePayload } from './response-utils';

const SEND_REMINDER_TIMEOUT_MS = 15000;

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
      const response = await createAuthenticatedFetch(
        `${BASE_URL}/api/orders/${orderId}/reminder`,
        {
          body: JSON.stringify({ channel, message }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
        SEND_REMINDER_TIMEOUT_MS
      );
      const responseText = await response.text();
      const payload = parseResponsePayload(responseText);

      if (!response.ok) {
        const errorMessage =
          payload &&
          typeof payload === 'object' &&
          typeof payload.error === 'string'
            ? payload.error
            : responseText ||
              `Request failed: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      return payload;
    },
    mutationKey: ['sendReminder'],
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
