import { z } from 'zod';
import { MAX_CANCELLATION_REASON_LENGTH } from '@/config/order-cancellation';

export { MAX_CANCELLATION_REASON_LENGTH };

/**
 * Body schema for `POST /api/storefront/account/orders/[id]/cancel`.
 *
 * The reason is optional (cancellation is skippable). When present it is a
 * trimmed, bounded string — this covers both the preset
 * `CUSTOMER_CANCELLATION_REASONS` and the free text typed for the "Other"
 * option, so we accept any non-empty bounded string rather than an enum.
 */
export const storefrontOrderCancellationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Reason cannot be empty')
    .max(
      MAX_CANCELLATION_REASON_LENGTH,
      `Reason must be ${MAX_CANCELLATION_REASON_LENGTH} characters or fewer`
    )
    .optional(),
});

export type StorefrontOrderCancellationInput = z.infer<
  typeof storefrontOrderCancellationSchema
>;
