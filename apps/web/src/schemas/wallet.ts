import { z } from 'zod';

export const walletSettingsSchema = z.object({
  autoPayoutEnabled: z.boolean().optional(),
  autoPayoutDay: z
    .enum([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ])
    .optional(),
  minPayoutAmount: z.number().min(100).max(10_000_000).optional(),
});
