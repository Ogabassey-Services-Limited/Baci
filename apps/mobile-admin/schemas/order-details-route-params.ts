import { z } from 'zod';

export const orderDetailsRouteParamsSchema = z.object({
  action: z.enum(['record-payment', 'ship-on-credit']).optional(),
  id: z.string().uuid(),
});
