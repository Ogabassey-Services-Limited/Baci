import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { useMerchant } from '../useMerchant';

const SHIP_ON_CREDIT_TIMEOUT_MS = 15000;

function parseResponsePayload(
  text: string
): Record<string, unknown> | string | null {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
}

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
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        SHIP_ON_CREDIT_TIMEOUT_MS
      );

      try {
        const response = await fetch(
          `${BASE_URL}/api/orders/${orderId}/ship-on-credit`,
          {
            body: JSON.stringify({ credit_notes: creditNotes }),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            method: 'POST',
            signal: controller.signal,
          }
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
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(
            'Request timed out. Please check your connection and try again.'
          );
        }

        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    mutationKey: ['shipOnCredit'],
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });

      if (merchant?.id) {
        queryClient.invalidateQueries({ queryKey: ['orders', merchant.id] });
        queryClient.invalidateQueries({
          queryKey: ['order-counts', merchant.id],
        });
      }
    },
  });
}
