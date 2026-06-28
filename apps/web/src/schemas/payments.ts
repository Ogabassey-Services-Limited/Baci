import { z } from 'zod';

/**
 * Schema for payment reference validation
 */
export const referenceSchema = z.string().trim().min(1).max(100);

/**
 * Schema for JSON payment verification requests.
 */
export const verifyPaymentBodySchema = z.object({
  reference: referenceSchema,
});

const nullableStringFromUnknown = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() ? value.trim() : null),
  z.string().nullable()
);

/**
 * Normalized Paystack fields persisted for zero-candidate reconciliation review.
 */
export const paystackZeroCandidateReviewGatewayResponseSchema = z
  .object({
    channel: nullableStringFromUnknown,
    customer: z.preprocess(
      (value) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? value
          : {},
      z.object({
        email: nullableStringFromUnknown,
      })
    ),
    paid_at: nullableStringFromUnknown,
  })
  .passthrough();
