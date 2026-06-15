import { useRef, useState } from 'react';
import { createStorefrontCustomerApiClient } from '@/lib/storefront-customer-api-client';

const ORDER_NOT_CANCELLABLE_CODE = 'order_not_cancellable';
const GENERIC_CANCEL_ERROR = 'Could not cancel this order. Please try again.';

function getErrorCode(error: unknown) {
  return error instanceof Error &&
    typeof (error as { code?: unknown }).code === 'string'
    ? ((error as { code?: string }).code as string)
    : undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : GENERIC_CANCEL_ERROR;
}

/**
 * Wraps the customer-facing cancel-order API call with loading/error state.
 *
 * `cancelOrder` resolves `true` on success. The server returns a 409 with
 * `code === 'order_not_cancellable'` once an order can no longer be cancelled
 * (e.g. a payment is in flight); that expected conflict resolves `false` and is
 * surfaced via `notCancellable` so the UI can prompt a refresh. Other failures
 * are re-thrown after local error state is updated so callers can show explicit
 * feedback instead of silently ignoring the failed attempt.
 */
export function useCancelOrder(orderId: string) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notCancellable, setNotCancellable] = useState(false);
  const apiClientRef = useRef(createStorefrontCustomerApiClient());

  const cancelOrder = async (reason?: string) => {
    setIsCancelling(true);
    setError(null);
    setNotCancellable(false);

    try {
      await apiClientRef.current.fetchJson({
        body: reason ? { reason } : {},
        method: 'POST',
        path: `/api/storefront/account/orders/${orderId}/cancel`,
      });
      return true;
    } catch (cancelError) {
      const errorMessage = getErrorMessage(cancelError);
      setError(errorMessage);

      if (getErrorCode(cancelError) === ORDER_NOT_CANCELLABLE_CODE) {
        setNotCancellable(true);
        return false;
      }

      throw cancelError instanceof Error
        ? cancelError
        : new Error(errorMessage);
    } finally {
      setIsCancelling(false);
    }
  };

  return { cancelOrder, error, isCancelling, notCancellable };
}
