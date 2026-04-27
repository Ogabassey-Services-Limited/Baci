import { z } from 'zod';

export const vtuCashbackSummaryCronQuerySchema = z.object({
  now: z.string().datetime({ message: 'Invalid now parameter' }).optional(),
});
