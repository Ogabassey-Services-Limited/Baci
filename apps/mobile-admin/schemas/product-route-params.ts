import { z } from 'zod';

export const routeParamsSchema = z.object({
  id: z.union([z.literal('new'), z.string().uuid()]),
});
