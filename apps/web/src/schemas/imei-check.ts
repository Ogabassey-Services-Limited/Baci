import { z } from 'zod';

export const imeiCheckSchema = z.object({
  imei: z.string(),
  tier: z.string().optional(),
});

export type ImeiCheckInput = z.infer<typeof imeiCheckSchema>;
