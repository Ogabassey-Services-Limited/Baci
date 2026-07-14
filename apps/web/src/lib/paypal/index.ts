// Barrel for the PayPal client library (Wave 2 — see
// docs/payments/byok-payment-providers-plan.md Phase 2). Credentials are
// always caller-supplied parameters; routes are responsible for sourcing
// them from the vault (lib/payments/merchant-credentials.ts) and for any FX
// conversion — this library stays pure PayPal API.
export { generateClientToken, getAccessToken } from './paypal-auth';
export {
  formatPayPalAmount,
  normalizePayPalCurrency,
  PAYPAL_SUPPORTED_CURRENCIES,
  PAYPAL_ZERO_DECIMAL_CURRENCIES,
} from './paypal-currency';
export {
  getPayPalBaseUrl,
  PAYPAL_LIVE_API_URL,
  PAYPAL_SANDBOX_API_URL,
} from './paypal-endpoints';
export { detectPayPalResponseMode } from './paypal-mode-guard';
export { captureOrder, createOrder, getOrder } from './paypal-orders';
export { getRefund, refund } from './paypal-refunds';
export type {
  PayPalCaptureResponse,
  PayPalCreateOrderOptions,
  PayPalLink,
  PayPalMode,
  PayPalOrderDetails,
  PayPalRefundOptions,
  PayPalRefundResponse,
  PayPalResult,
} from './paypal-types';
export {
  PayPalCaptureResponseSchema,
  PayPalLinkSchema,
  PayPalOAuthSchema,
  PayPalOrderDetailsSchema,
  PayPalOrderResponseSchema,
  PayPalRefundResponseSchema,
} from './paypal-types';
