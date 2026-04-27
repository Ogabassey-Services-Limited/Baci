import { z } from 'zod';

export const vtuCashbackSummaryCronQuerySchema = z.object({
  now: z
    .string()
    .datetime({ message: 'now must be an ISO 8601 datetime string' })
    .optional(),
});
