import { z } from 'zod';
import { dateOfBirthSchema } from '@/schemas/customer-date-of-birth';

const savedAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  full_name: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
  postal_code: z.string().optional(),
  is_default: z.boolean().optional(),
});

/**
 * Body schema for `PATCH /api/storefront/customer` (storefront profile edits and
 * the quiz 18+ date-of-birth capture).
 */
export const customerProfilePatchSchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  date_of_birth: dateOfBirthSchema.optional(),
  saved_addresses: z.array(savedAddressSchema).optional(),
  /**
   * The auth user the caller intended to write for. Cookies are ambient, so if
   * the session switched to another shopper between capturing the form and this
   * request landing, the write would silently target the new account. When
   * provided the route rejects the mismatch (409) so a stale submit — e.g. the
   * quiz 18+ gate saving a DOB — cannot write to whoever is currently signed in.
   */
  expected_user_id: z.string().min(1).optional(),
});

export type CustomerProfilePatchInput = z.infer<
  typeof customerProfilePatchSchema
>;
