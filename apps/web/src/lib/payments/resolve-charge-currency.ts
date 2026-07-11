/**
 * Payment charge-currency resolution (multi-country hardening).
 *
 * The charge currency is ALWAYS the order's currency (server-authoritative from
 * the order snapshot). The client never dictates it. This helper:
 *  - fails closed when the client EXPLICITLY sends a currency that disagrees
 *    with the order (CURRENCY_MISMATCH), and
 *  - rejects an order whose currency the SELECTED gateway cannot charge
 *    (UNSUPPORTED_CURRENCY) instead of silently coercing it to NGN.
 *
 * This is kept consistent with the payments webhook currency-mismatch guard,
 * which compares the recorded transaction currency against the gateway-reported
 * currency. NGN is supported by every gateway, so the existing Nigerian flow is
 * unchanged.
 */

import { SUPPORTED_CURRENCIES } from '@/lib/korapay';

/**
 * Fallback for legacy order rows with no stamped currency. These are all
 * genuinely NGN, so an empty order currency must not fail a Nigerian checkout.
 */
const DEFAULT_CHARGE_CURRENCY = 'NGN';

/** Gateways that can only ever charge Nigerian Naira today. */
const NGN_ONLY: readonly string[] = ['NGN'];

export type PaymentGatewayId =
  | 'paystack'
  | 'korapay'
  | 'juicyway'
  | 'credit_direct'
  | 'credpal'
  | 'klump';

/**
 * Per-gateway currency support.
 * - korapay is the only multi-currency rail today (its SUPPORTED_CURRENCIES).
 * - paystack: PaymentInitData has no currency field, so it charges the
 *   integration default (NGN) regardless — a non-NGN order routed here would be
 *   charged in the wrong currency.
 * - klump / credit_direct / credpal: Nigerian BNPL rails.
 * - juicyway: the NGN fiat leg drives an NGN-kobo -> USDT conversion; a non-NGN
 *   order would convert against the wrong base.
 */
const GATEWAY_CURRENCY_SUPPORT: Record<PaymentGatewayId, readonly string[]> = {
  korapay: SUPPORTED_CURRENCIES,
  paystack: NGN_ONLY,
  klump: NGN_ONLY,
  credit_direct: NGN_ONLY,
  credpal: NGN_ONLY,
  juicyway: NGN_ONLY,
};

export type ChargeCurrencyResolution =
  | { ok: true; currency: string }
  | {
      ok: false;
      error: string;
      code: 'CURRENCY_MISMATCH' | 'UNSUPPORTED_CURRENCY';
    };

function normalize(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function resolveChargeCurrency(input: {
  orderCurrency: string | null | undefined;
  clientCurrency: string | null | undefined;
  gateway: PaymentGatewayId;
}): ChargeCurrencyResolution {
  const orderCurrency =
    normalize(input.orderCurrency) || DEFAULT_CHARGE_CURRENCY;
  const clientCurrency = normalize(input.clientCurrency);

  // The client never sets the charge currency. If it explicitly sent one that
  // disagrees with the order, reject rather than charge a currency the shopper
  // did not agree to.
  if (clientCurrency && clientCurrency !== orderCurrency) {
    return {
      ok: false,
      error: 'Payment currency does not match the order currency',
      code: 'CURRENCY_MISMATCH',
    };
  }

  const supported = GATEWAY_CURRENCY_SUPPORT[input.gateway] ?? NGN_ONLY;
  if (!supported.includes(orderCurrency)) {
    return {
      ok: false,
      error: `The selected payment method cannot charge ${orderCurrency}`,
      code: 'UNSUPPORTED_CURRENCY',
    };
  }

  return { ok: true, currency: orderCurrency };
}
