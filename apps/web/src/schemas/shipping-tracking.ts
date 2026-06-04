import { z } from 'zod';

export const trackingParamsSchema = z.object({
  trackingNumber: z.string().trim().min(1, 'Tracking number required'),
});
