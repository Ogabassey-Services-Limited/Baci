import {
  type ImeiServiceTierKey,
  isImeiServiceTierKey,
} from '@baci/shared/imei';
import { z } from 'zod';

export const imeiCheckSchema = z.object({
  imei: z.string().regex(/^\d{15}$/, 'IMEI must be 15 digits'),
  tier: z
    .string()
    .default('full')
    .refine(
      (value): value is ImeiServiceTierKey => isImeiServiceTierKey(value),
      {
        message: 'Invalid service tier',
      }
    ),
});

export type ImeiCheckInput = z.infer<typeof imeiCheckSchema>;
