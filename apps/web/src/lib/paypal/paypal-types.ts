/**
 * Shared PayPal API types and response-validation schemas.
 *
 * Ported from the `paypal-integration` prototype's `lib/paypal.ts` (Wave 2,
 * see docs/payments/byok-payment-providers-plan.md Phase 2). Credentials are
 * always caller-supplied parameters — this module never reads env vars and
 * never touches the credential vault (routes compose those, per Phase 0.2).
 */
import z from 'zod';

export type PayPalMode = 'sandbox' | 'live';

export type PayPalResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type PayPalCreateOrderOptions = {
  returnUrl?: string;
  cancelUrl?: string;
};

export type PayPalRefundOptions = {
  /** Partial refund amount in the capture's presentment currency. Omit for a full refund. */
  amount?: number;
  currency?: string;
  noteToPayer?: string;
  /** Client-supplied idempotency key (PayPal-Request-Id header). */
  requestId?: string;
};

// =============================================================================
// Zod Validation Schemas
// =============================================================================

export const PayPalOAuthSchema = z.object({
  scope: z.string(),
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  nonce: z.string().optional(),
});

/**
 * A single PayPal HATEOAS link. The `self` link's host is the only reliable,
 * provider-controlled signal for which environment (sandbox vs live) served a
 * response — see `paypal-mode-guard.ts`.
 */
export const PayPalLinkSchema = z.object({
  href: z.string().url(),
  rel: z.string(),
  method: z.string(),
});

export const PayPalOrderResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  links: z.array(PayPalLinkSchema),
});

const PayPalCaptureSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.object({
    currency_code: z.string(),
    value: z.string(),
  }),
});

export const PayPalCaptureResponseSchema = z.object({
  id: z.string(),
  status: z.enum([
    'COMPLETED',
    'SAVED',
    'APPROVED',
    'VOIDED',
    'PAYER_ACTION_REQUIRED',
  ]),
  purchase_units: z.array(
    z.object({
      payments: z.object({
        captures: z.array(PayPalCaptureSchema),
      }),
    })
  ),
  // Not part of the prototype's schema, but present on real Orders v2
  // capture responses (the resource returned is the full order). Optional
  // here so a shape lacking it still parses; callers that need the
  // sandbox/live mode check should treat a missing `links` as "unknown".
  links: z.array(PayPalLinkSchema).optional(),
});

/**
 * Relaxed "get order" response shape used for reconciliation lookups
 * (`getOrder`). Unlike a fresh capture response, an order fetched by id may
 * or may not have been captured yet, so `purchase_units[].payments` is
 * optional.
 */
export const PayPalOrderDetailsSchema = z.object({
  id: z.string(),
  status: z.string(),
  links: z.array(PayPalLinkSchema).optional(),
  purchase_units: z
    .array(
      z.object({
        payments: z
          .object({
            captures: z.array(PayPalCaptureSchema).optional(),
          })
          .optional(),
      })
    )
    .optional(),
});

export const PayPalRefundResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['COMPLETED', 'PENDING', 'CANCELLED', 'FAILED']),
  amount: z
    .object({
      currency_code: z.string(),
      value: z.string(),
    })
    .optional(),
  links: z.array(PayPalLinkSchema).optional(),
});

export type PayPalCaptureResponse = z.infer<typeof PayPalCaptureResponseSchema>;
export type PayPalOrderDetails = z.infer<typeof PayPalOrderDetailsSchema>;
export type PayPalRefundResponse = z.infer<typeof PayPalRefundResponseSchema>;
export type PayPalLink = z.infer<typeof PayPalLinkSchema>;
