import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { useMerchant } from '../useMerchant';
import { createAuthenticatedFetch } from './authenticated-fetch';
import { parseResponsePayload } from './response-utils';

const SHIP_ON_CREDIT_TIMEOUT_MS = 15000;

interface ShipOnCreditResponse {
  message: string;
  order: {
    id: string;
    is_credit_order: boolean;
    order_number: string | null;
    shipping_status: string;
  };
  success: boolean;
  virtualAccount: {
    account_name: string;
    account_number: string;
    bank_name: string;
  } | null;
}

function isShipOnCreditResponse(
  payload: unknown
): payload is ShipOnCreditResponse {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const order =
    typeof record.order === 'object' && record.order !== null
      ? (record.order as Record<string, unknown>)
      : null;
  const virtualAccount =
    typeof record.virtualAccount === 'object' && record.virtualAccount !== null
      ? (record.virtualAccount as Record<string, unknown>)
      : null;

  return (
    record.success === true &&
    typeof record.message === 'string' &&
    order !== null &&
    typeof order.id === 'string' &&
    (typeof order.order_number === 'string' || order.order_number === null) &&
    typeof order.shipping_status === 'string' &&
    typeof order.is_credit_order === 'boolean' &&
    (record.virtualAccount === null ||
      (virtualAccount !== null &&
        typeof virtualAccount.account_name === 'string' &&
        typeof virtualAccount.account_number === 'string' &&
        typeof virtualAccount.bank_name === 'string'))
  );
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

      if (!isShipOnCreditResponse(payload)) {
        throw new Error('Failed to ship on credit');
      }

      return payload;
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
