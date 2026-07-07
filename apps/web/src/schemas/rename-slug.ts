import { z } from 'zod';

/**
 * Storefront slug shape — the same lowercase/hyphenated form `generate_slug()`
 * and `rename_merchant_slug()` produce/accept. The RPC re-validates authoritatively
 * (including the reserved-word list and uniqueness); this schema is the client/route
 * guard so obvious mistakes fail fast with a friendly message.
 */
export const STORE_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const renameSlugSchema = z.object({
  new_slug: z
    .string()
    .trim()
    .min(3, 'Store URL must be at least 3 characters.')
    .max(63, 'Store URL must be 63 characters or fewer.')
    .regex(
      STORE_SLUG_PATTERN,
      'Use only lowercase letters, numbers, and hyphens (no spaces, no leading or trailing hyphen).'
    ),
});

export type RenameSlugInput = z.infer<typeof renameSlugSchema>;
