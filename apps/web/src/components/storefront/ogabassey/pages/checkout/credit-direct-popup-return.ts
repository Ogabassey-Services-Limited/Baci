export const CREDIT_DIRECT_POPUP_MARKER_PREFIX = 'baci_credit_direct_popup:';

export interface CreditDirectPopupMarker {
  transactionId: string;
  storedAt: string;
}

function getMarkerStorageKey(orderId: string) {
  return `${CREDIT_DIRECT_POPUP_MARKER_PREFIX}${orderId}`;
}

/**
 * Records that the Credit Direct SDK opened its hosted popup for an order.
 *
 * Inside the mobile WebView the popup replaces the launcher document, so this
 * sessionStorage marker is the only signal — on returning to the launcher —
 * that a checkout attempt is already in flight and the page must verify the
 * order status instead of relaunching the SDK from scratch.
 */
export function writeCreditDirectPopupMarker(
  orderId: string,
  transactionId: string,
): void {
  if (typeof window === 'undefined') return;

  try {
    const marker: CreditDirectPopupMarker = {
      transactionId,
      storedAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem(
      getMarkerStorageKey(orderId),
      JSON.stringify(marker),
    );
  } catch {
    // Storage failures must never break the payment flow.
  }
}

export function readCreditDirectPopupMarker(
  orderId: string | null,
): CreditDirectPopupMarker | null {
  if (!orderId || typeof window === 'undefined') return null;

  try {
    const stored = window.sessionStorage.getItem(getMarkerStorageKey(orderId));
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<CreditDirectPopupMarker>;
    if (typeof parsed.transactionId !== 'string' || !parsed.transactionId) {
      return null;
    }

    return {
      transactionId: parsed.transactionId,
      storedAt: typeof parsed.storedAt === 'string' ? parsed.storedAt : '',
    };
  } catch {
    return null;
  }
}

export function clearCreditDirectPopupMarker(orderId: string | null): void {
  if (!orderId || typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(getMarkerStorageKey(orderId));
  } catch {
    // Ignore storage access failures.
  }
}
