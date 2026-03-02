import { z } from 'zod';

/**
 * Schema for the storefront loyalty redemption request body.
 */
export const loyaltyRedeemSchema = z.object({
  merchant_id: z.string().uuid('merchant_id must be a valid UUID'),
  customer_id: z.string().uuid('customer_id must be a valid UUID'),
  reward_id: z.string().uuid('reward_id must be a valid UUID'),
});

export type LoyaltyRedeemInput = z.infer<typeof loyaltyRedeemSchema>;
