import {
  type ImeiServiceTierKey,
  isImeiServiceTierKey,
} from '@baci/shared/imei';
import { z } from 'zod';

export const imeiCheckSchema = z.object({
  // Accepts an IMEI (15 digits) or an Apple serial (8–14 alphanumeric). The
  // route enforces the exact rule for the selected tier's identifier type.
  imei: z
    .string()
    .regex(/^[A-Za-z0-9]{8,15}$/, 'Enter a valid IMEI or serial number'),
  tier: z
    .string()
    .default('full')
    .refine(
      (value): value is ImeiServiceTierKey => isImeiServiceTierKey(value),
      {
        error: 'Invalid service tier',
      }
    ),
});

export type ImeiCheckInput = z.infer<typeof imeiCheckSchema>;
