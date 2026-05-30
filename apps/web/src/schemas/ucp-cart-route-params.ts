import { z } from 'zod';

export const ucpCartRouteParamsSchema = z.object({
  id: z.string().trim().min(1, 'Cart id is required'),
});
