import { writeCreditDirectPopupMarker } from '@/components/storefront/ogabassey/pages/checkout/credit-direct-popup-return';

interface LegacyCreditDirectPopupInput {
  orderId: string;
  signedSessionId: string;
  checkoutTransactionId?: string;
  updatePaymentReference: (input: {
    orderId: string;
    paymentRef: string;
  }) => Promise<string | null>;
}

export async function captureLegacyCreditDirectPopup({
  orderId,
  signedSessionId,
  checkoutTransactionId,
  updatePaymentReference,
}: LegacyCreditDirectPopupInput): Promise<string | null> {
  const transactionId = checkoutTransactionId?.trim() || null;
  const markerReference = transactionId ?? signedSessionId.trim();

  if (markerReference) {
    writeCreditDirectPopupMarker(orderId, markerReference);
  }

  if (!transactionId) {
    return null;
  }

  return await updatePaymentReference({
    orderId,
    paymentRef: transactionId,
  });
}
