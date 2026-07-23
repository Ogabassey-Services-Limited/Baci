import {
  type CreditDirectPopupMarker,
  readCreditDirectPopupMarker,
  writeCreditDirectPopupMarker,
} from './credit-direct-popup-return';
import { fetchWithCsrf } from '@/lib/api-client';

interface CreditDirectClientCompletion {
  orderId: string;
  checkoutTransactionId?: string | null;
  customerEmail?: string | null;
  sessionId?: string | null;
  trackingToken?: string | null;
}

type ClientCompletionFetch = (
  input: string,
  init?: RequestInit
) => Promise<Pick<Response, 'ok' | 'status' | 'statusText'>>;

/**
 * Captures the SDK's untrusted success evidence without treating it as payment
 * confirmation. The marker is written synchronously so verification survives
 * a route handoff even when the best-effort server request fails.
 */
export function captureCreditDirectClientCompletion(
  {
    orderId,
    checkoutTransactionId,
    customerEmail,
    sessionId,
    trackingToken,
  }: CreditDirectClientCompletion,
  fetcher: ClientCompletionFetch = fetchWithCsrf
): CreditDirectPopupMarker {
  const markerTransactionId = checkoutTransactionId || sessionId;
  if (!markerTransactionId) {
    throw new Error('Credit Direct completion reference is required');
  }
  const fallbackMarker: CreditDirectPopupMarker = {
    source: 'sdk_success',
    transactionId: markerTransactionId,
    storedAt: new Date().toISOString(),
  };
  writeCreditDirectPopupMarker(orderId, markerTransactionId, 'sdk_success');
  const storedMarker = readCreditDirectPopupMarker(orderId);
  const marker =
    storedMarker?.transactionId === markerTransactionId &&
    storedMarker.source === 'sdk_success'
      ? storedMarker
      : fallbackMarker;

  void fetcher('/api/orders/credit-direct/client-completion', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      ...(checkoutTransactionId && { checkoutTransactionId }),
      ...(customerEmail && { customerEmail }),
      ...(sessionId && { sessionId }),
      ...(trackingToken && { tracking_token: trackingToken }),
    }),
  })
    .then((response) => {
      if (!response.ok) {
        console.error('Failed to record Credit Direct client completion:', {
          orderId,
          status: response.status,
          statusText: response.statusText,
        });
      }
    })
    .catch((error: unknown) => {
      console.error(
        'Failed to record Credit Direct client completion:',
        error instanceof Error ? error.message : error
      );
    });

  return marker;
}
