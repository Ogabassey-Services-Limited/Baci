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
