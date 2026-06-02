import { z } from 'zod';

export const vtuCashbackSummaryCronQuerySchema = z.object({
  now: z.iso
    .datetime({
      error: 'now must be an ISO 8601 datetime string',
    })
    .optional(),
});
