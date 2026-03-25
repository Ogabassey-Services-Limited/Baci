/**
 * Jumia Vendor Center API — Shop schemas
 */

import { z } from 'zod';

export const JumiaBusinessClientSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((s) => s.toUpperCase()),
  countryName: z.string().trim().min(1),
  status: z.enum(['active', 'inactive', 'pending']),
  shortCode: z.string().trim().min(1),
});

export const JumiaShopSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  businessClients: z.array(JumiaBusinessClientSchema),
});

export const JumiaShopsResponseSchema = z.object({
  shops: z.array(JumiaShopSchema),
});

export type JumiaShopsResponse = z.infer<typeof JumiaShopsResponseSchema>;
export type JumiaShop = z.infer<typeof JumiaShopSchema>;
export type JumiaBusinessClient = z.infer<typeof JumiaBusinessClientSchema>;
