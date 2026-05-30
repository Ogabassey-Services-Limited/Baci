interface CreditDirectPopupOrder {
  id: string;
  tracking_token?: string | null;
}

type PopupReferenceResponse = Pick<Response, 'ok' | 'status' | 'statusText'> &
  Partial<Pick<Response, 'text'>>;

type PopupReferenceFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<PopupReferenceResponse>;

async function readFailureDetails(
  response: PopupReferenceResponse,
): Promise<string> {
  if (typeof response.text !== 'function') return '';

  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function persistCreditDirectPopupReference(
  order: CreditDirectPopupOrder,
  transactionId: string,
  fetcher: PopupReferenceFetch = globalThis.fetch,
): Promise<void> {
  const response = await fetcher('/api/orders/update-payment-ref', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: order.id,
      paymentRef: transactionId,
      gateway: 'credit_direct',
      ...(order.tracking_token && {
        tracking_token: order.tracking_token,
      }),
    }),
  });

  if (response.ok) return;

  const details = await readFailureDetails(response);
  const statusText = response.statusText || 'Unknown status';
  const suffix = details ? `: ${details}` : '';

  throw new Error(
    `Failed to persist Credit Direct popup reference for order ${order.id} and transaction ${transactionId}: ${response.status} ${statusText}${suffix}`,
  );
}
