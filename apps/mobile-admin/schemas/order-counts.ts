import { z } from 'zod';

const orderCountSchema = z.number().int().nonnegative();

export const orderCountsSchema = z.strictObject({
  all: orderCountSchema,
  paid: orderCountSchema,
  pending: orderCountSchema,
  processing: orderCountSchema,
  shipped: orderCountSchema,
  delivered: orderCountSchema,
  cancelled: orderCountSchema,
  returned: orderCountSchema,
});

export type OrderCounts = z.infer<typeof orderCountsSchema>;
