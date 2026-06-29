import { z } from 'zod';

/** `GET /api/insurance/policy/[orderId]` route params. */
export const orderPolicyRouteParamsSchema = z.object({
  orderId: z.uuid(),
});

/** Order id from the storefront insurance policy page route. */
export const insuranceOrderIdParamSchema = z.uuid();
