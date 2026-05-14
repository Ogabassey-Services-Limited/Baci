import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { BASE_URL } from '@/lib/api-client';
import { shipOnCreditResponseSchema } from '@/schemas/ship-on-credit-response';
import { useMerchant } from '../useMerchant';
import { createAuthenticatedFetch } from './authenticated-fetch';
import { parseResponsePayload } from './response-utils';

const SHIP_ON_CREDIT_TIMEOUT_MS = 15000;

type ShipOnCreditResponse = z.infer<typeof shipOnCreditResponseSchema>;

function formatShipOnCreditValidationError(error: z.ZodError): string {
  const invalidFields = error.issues
    .map((issue) => issue.path.join('.') || issue.code)
    .join(', ');

  if (!invalidFields) {
    return 'Failed to ship on credit: invalid response payload';
  }

  return `Failed to ship on credit: invalid response fields (${invalidFields})`;
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
    }): Promise<ShipOnCreditResponse> => {
      const response = await createAuthenticatedFetch(
        `${BASE_URL}/api/orders/${orderId}/ship-on-credit`,
        {
          body: JSON.stringify({ credit_notes: creditNotes }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
        SHIP_ON_CREDIT_TIMEOUT_MS
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

      const parsedPayload = shipOnCreditResponseSchema.safeParse(payload);
      if (!parsedPayload.success) {
        throw new Error(formatShipOnCreditValidationError(parsedPayload.error));
      }

      return parsedPayload.data;
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
