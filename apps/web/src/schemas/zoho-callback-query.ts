import { z } from 'zod';

export const zohoCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  error_description: z.string().optional(),
  state: z.string().min(1).optional(),
});
