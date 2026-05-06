import { z } from 'zod';

export const agenticOrderRouteParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Order id is required')
    .max(255, 'Order id is too long')
    .uuid('Order id must be a UUID'),
});
