import { z } from 'zod';

export const eventPipelineOperationsSchema = z.strictObject({
  deliveries: z.array(z.record(z.string(), z.unknown())),
  heartbeats: z.array(z.record(z.string(), z.unknown())),
  queue: z.record(z.string(), z.unknown()).nullable(),
});
