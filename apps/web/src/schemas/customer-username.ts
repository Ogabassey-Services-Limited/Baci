import { z } from 'zod';
import {
  cleanUsername,
  isValidUsername,
  USERNAME_MAX_LENGTH,
} from '@/lib/username-normalize';

/**
 * Request body for POST /api/storefront/customer/username. The username is
 * cleaned (NFKC + zero-width strip) and validated to the same charset/length
 * the `set_customer_username` RPC enforces, so the client gets an immediate,
 * friendly error and the DB stays the authoritative guard.
 */
export const setCustomerUsernameSchema = z.object({
  merchantId: z.uuid(),
  username: z
    .string()
    .min(1)
    // Guard against pathological input before normalization work.
    .max(USERNAME_MAX_LENGTH * 4)
    .transform(cleanUsername)
    .refine(isValidUsername, {
      message:
        'Use 3-20 letters, numbers, or single . _ separators (start and end with a letter or number).',
    }),
});

export type SetCustomerUsernameInput = z.infer<
  typeof setCustomerUsernameSchema
>;
