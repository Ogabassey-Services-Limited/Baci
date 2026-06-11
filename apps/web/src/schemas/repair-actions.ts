import { z } from 'zod';

export const repairMerchantIdSchema = z.uuid();

export const repairPlaceDetailsSchema = z.object({
  streetNumber: z.string().max(32).optional().default(''),
  route: z.string().max(200).optional().default(''),
  city: z.string().max(120).optional().default(''),
  state: z.string().max(120).optional().default(''),
  zip: z.string().max(32).optional().default(''),
  country: z.string().max(120).optional().default(''),
  formattedAddress: z.string().max(500).optional().default(''),
});

export type RepairPlaceDetails = z.output<typeof repairPlaceDetailsSchema>;
