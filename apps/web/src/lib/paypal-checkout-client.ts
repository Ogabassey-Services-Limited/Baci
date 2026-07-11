/**
 * Storefront PayPal checkout client (Wave 2, BYOK Phase 2 item 8).
 *
 * Drives the customer-facing PayPal flow entirely from the browser against the
 * landed server routes:
 *   1. `startPaypalCheckout` — POST `/api/payments/paypal/create-order`, stash a
 *      pending-capture context, then top-level redirect to PayPal's approval URL.
 *   2. `capturePaypalReturn` — on the redirect back, POST
 *      `/api/payments/paypal/capture-order` with the paypal order id PayPal
 *      appends as `?token=`.
 *
 * Amounts, currency and FX are all decided server-side (never trusted from here)
 * and the create-order/capture-order routes fail closed on a missing or invalid
 * vault credential, so this module only carries opaque ids + the customer email.
 */

const PAYPAL_PENDING_CONTEXT_KEY = 'baci:paypal-pending-context';

export interface PaypalPendingContext {
  orderId: string;
  customerEmail: string;
  merchantId: string;
  trackingToken?: string;
}

export function writePaypalPendingContext(context: PaypalPendingContext): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      PAYPAL_PENDING_CONTEXT_KEY,
      JSON.stringify(context)
    );
  } catch {
    // sessionStorage can throw (quota, private mode) — a lost context surfaces
    // as a clean "missing context" error on return rather than a crash.
  }
}

export function readPaypalPendingContext(): PaypalPendingContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PAYPAL_PENDING_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PaypalPendingContext>;
    if (
      typeof parsed.orderId === 'string' &&
      typeof parsed.customerEmail === 'string' &&
      typeof parsed.merchantId === 'string'
    ) {
      return {
        orderId: parsed.orderId,
        customerEmail: parsed.customerEmail,
        merchantId: parsed.merchantId,
        trackingToken:
          typeof parsed.trackingToken === 'string'
            ? parsed.trackingToken
            : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPaypalPendingContext(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PAYPAL_PENDING_CONTEXT_KEY);
  } catch {
    // Best-effort cleanup.
  }
}

/**
 * Query params PayPal owns on the return trip (`token` + `PayerID`) plus our
 * own flow markers. A retry builds the next return/cancel URL from
 * `window.location.href`, which — after a cancel or a failed capture — still
 * carries the *previous* attempt's `token`. If left in place, PayPal appends
 * the fresh order token as a second `token=` and `URLSearchParams.get('token')`
 * would read the STALE first value, capturing the wrong order. Strip them all
 * before we hand a clean URL back to PayPal.
 */
const PAYPAL_OWNED_QUERY_PARAMS = [
  'token',
  'PayerID',
  'paypal_return',
  'paypal_cancel',
] as const;

function stripPaypalOwnedParams(url: URL): void {
  for (const param of PAYPAL_OWNED_QUERY_PARAMS) {
    url.searchParams.delete(param);
  }
}

/**
 * Builds the same-origin return/cancel URLs PayPal redirects back to. Both are
 * derived from the current checkout URL (the create-order route rejects any
 * cross-origin URL), stripped of any stale PayPal-owned params from a prior
 * attempt, then tagged with a single disambiguating marker so the return
 * handler knows whether the buyer approved or cancelled.
 */
export function buildPaypalReturnUrls(currentHref: string): {
  returnUrl: string;
  cancelUrl: string;
} {
  const returnUrl = new URL(currentHref);
  stripPaypalOwnedParams(returnUrl);
  returnUrl.searchParams.set('paypal_return', '1');

  const cancelUrl = new URL(currentHref);
  stripPaypalOwnedParams(cancelUrl);
  cancelUrl.searchParams.set('paypal_cancel', '1');

  return { returnUrl: returnUrl.toString(), cancelUrl: cancelUrl.toString() };
}

export interface StartPaypalCheckoutParams {
  merchantId: string;
  orderId: string;
  customerEmail: string;
  trackingToken?: string;
}

/**
 * Creates the PayPal order server-side and redirects the browser to PayPal's
 * approval page. Throws on any failure so the caller's checkout error handler
 * surfaces the toast and re-enables the form.
 */
export async function startPaypalCheckout(
  params: StartPaypalCheckoutParams
): Promise<void> {
  const { merchantId, orderId, customerEmail, trackingToken } = params;
  const { returnUrl, cancelUrl } = buildPaypalReturnUrls(window.location.href);

  writePaypalPendingContext({
    orderId,
    customerEmail,
    merchantId,
    trackingToken,
  });

  const res = await fetch('/api/payments/paypal/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: orderId,
      customer_email: customerEmail,
      merchant_id: merchantId,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    }),
  });

  if (!res.ok) {
    clearPaypalPendingContext();
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || 'Failed to start PayPal checkout');
  }

  const data = (await res.json()) as { approveUrl?: string };
  if (!data.approveUrl) {
    clearPaypalPendingContext();
    throw new Error(
      'PayPal did not return an approval link. Please try again.'
    );
  }

  window.location.href = data.approveUrl;
}

export type CapturePaypalReturnResult =
  | { status: 'noop' }
  | { status: 'cancelled' }
  | { status: 'captured'; orderId: string; trackingToken?: string }
  | { status: 'error'; message: string; orderId?: string };

/**
 * Inspects the current location search for a PayPal redirect and, when present,
 * captures the payment. `expectedMerchantId` guards against acting on a stale
 * context from a different store. Idempotent server-side: a duplicate capture
 * on an already-completed transaction returns success.
 */
export async function capturePaypalReturn(
  search: string,
  expectedMerchantId: string | undefined
): Promise<CapturePaypalReturnResult> {
  const params = new URLSearchParams(search);

  if (params.get('paypal_cancel') === '1') {
    clearPaypalPendingContext();
    return { status: 'cancelled' };
  }

  if (params.get('paypal_return') !== '1') {
    return { status: 'noop' };
  }

  const paypalOrderId = params.get('token');
  const context = readPaypalPendingContext();

  if (!paypalOrderId || !context) {
    clearPaypalPendingContext();
    return { status: 'error', message: 'Missing PayPal return context' };
  }

  if (expectedMerchantId && context.merchantId !== expectedMerchantId) {
    // Context belongs to a different store — leave it untouched.
    return { status: 'noop' };
  }

  const res = await fetch('/api/payments/paypal/capture-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: context.orderId,
      paypal_order_id: paypalOrderId,
      customer_email: context.customerEmail,
      merchant_id: context.merchantId,
    }),
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      status: 'error',
      message: error.error || 'Failed to capture PayPal payment',
      orderId: context.orderId,
    };
  }

  clearPaypalPendingContext();
  return {
    status: 'captured',
    orderId: context.orderId,
    trackingToken: context.trackingToken,
  };
}
