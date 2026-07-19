import { z } from 'zod';

export const eventPipelineListResultSchema = z.strictObject({
  count: z.number().int().nonnegative(),
  items: z.array(z.record(z.string(), z.unknown())),
});
