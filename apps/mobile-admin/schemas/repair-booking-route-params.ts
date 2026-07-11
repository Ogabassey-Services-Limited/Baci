import { z } from 'zod';

export const repairBookingRouteParamsSchema = z.object({
  id: z.uuid(),
});
