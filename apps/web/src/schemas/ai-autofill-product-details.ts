import { z } from 'zod';

/**
 * Runtime input validation for the product autofill AI flow.
 *
 * Max lengths are intentionally ABOVE the `sanitizePromptInput` caps
 * (200 / 100) so moderately long inputs keep the existing truncate-and-warn
 * behavior, while absurdly large payloads are rejected outright.
 */
export const AutofillProductDetailsInputSchema = z.object({
  productName: z
    .string()
    .min(1)
    .max(2000)
    .describe('The name of the product to generate details for.'),
  businessType: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "The merchant's business category (e.g., 'fashion', 'electronics')."
    ),
});

export type AutofillProductDetailsInput = z.infer<
  typeof AutofillProductDetailsInputSchema
>;
