import { z } from 'zod';

export const domainEventWorkerMessageSchema = z.strictObject({
  enqueued_at: z.iso.datetime({ offset: true }),
  message: z.unknown(),
  msg_id: z.number().int().positive(),
  read_ct: z.number().int().positive(),
  visible_at: z.iso.datetime({ offset: true }),
});
