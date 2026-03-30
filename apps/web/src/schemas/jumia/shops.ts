/**
 * Jumia Vendor Center API — Shop schemas
 */

import { z } from 'zod';

export const JumiaBusinessClientSchema = z.object({
  name: z.string().trim().min(1, 'Business client name is required'),
  code: z.string().trim().min(1, 'Business client code is required'),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Country code must be a 2-letter ISO code')
    .transform((s) => s.toUpperCase()),
  countryName: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? ''),
  status: z.preprocess(
    (value) => (typeof value === 'string' ? value.toLowerCase() : value),
    z.enum(['active', 'inactive', 'pending'], {
      errorMap: () => ({
        message: 'Status must be active, inactive, or pending',
      }),
    })
  ),
  shortCode: z.string().trim().min(1, 'Short code is required'),
});

export const JumiaShopSchema = z.object({
  id: z.string().trim().min(1, 'Shop ID is required'),
  name: z.string().trim().min(1, 'Shop name is required'),
  email: z.string().trim().email('Shop email must be a valid email address'),
  businessClients: z
    .array(JumiaBusinessClientSchema)
    .min(1, 'At least one business client is required'),
});

export type JumiaShop = z.infer<typeof JumiaShopSchema>;
export type JumiaBusinessClient = z.infer<typeof JumiaBusinessClientSchema>;

const JumiaShopsArraySchema = z
  .array(JumiaShopSchema)
  .min(1, 'At least one shop is required');

export const JumiaShopsResponseSchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return { shops: value };
    }

    return value;
  },
  z.object({
    shops: JumiaShopsArraySchema,
  })
);

export type JumiaShopsResponse = z.infer<typeof JumiaShopsResponseSchema>;
