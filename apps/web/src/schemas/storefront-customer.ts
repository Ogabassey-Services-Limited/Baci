import { z } from 'zod';

export const savedAddressSchema = z.object({
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

export const patchBodySchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  saved_addresses: z.array(savedAddressSchema).optional(),
});
