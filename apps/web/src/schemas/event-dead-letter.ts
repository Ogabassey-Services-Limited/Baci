import { z } from 'zod';

export const eventDeadLetterQuerySchema = z.strictObject({
  destination: z.enum(['facebook', 'ga4', 'snapchat', 'tiktok']).optional(),
  error_code: z.string().min(1).max(100).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  kind: z.enum(['all', 'delivery', 'ingress', 'unknown']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  merchant_id: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  to: z.iso.datetime({ offset: true }).optional(),
});

export const eventDeadLetterReplaySchema = z.discriminatedUnion('kind', [
  z.strictObject({
    failure_id: z.uuid(),
    kind: z.literal('ingress'),
    reason: z.string().trim().min(3).max(1_000),
  }),
  z.strictObject({
    delivery_ids: z.array(z.uuid()).min(1).max(100),
    kind: z.literal('delivery'),
    reason: z.string().trim().min(3).max(1_000),
  }),
  z.strictObject({
    destination: z.enum(['facebook', 'ga4', 'snapchat', 'tiktok']),
    error_code: z.string().min(1).max(100).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    kind: z.literal('delivery_filter'),
    merchant_id: z.uuid().optional(),
    reason: z.string().trim().min(3).max(1_000),
    status: z.enum(['dead_letter', 'delivery_unknown']).default('dead_letter'),
    to: z.iso.datetime({ offset: true }).optional(),
  }),
]);

export const eventPipelineListResultSchema = z.strictObject({
  count: z.number().int().nonnegative(),
  items: z.array(z.record(z.string(), z.unknown())),
});

export const eventPipelineOperationsSchema = z.strictObject({
  deliveries: z.array(z.record(z.string(), z.unknown())),
  heartbeats: z.array(z.record(z.string(), z.unknown())),
  queue: z.record(z.string(), z.unknown()).nullable(),
});

export const eventPipelineReplayIdsSchema = z.array(z.uuid()).max(100);

export type EventDeadLetterQuery = z.infer<typeof eventDeadLetterQuerySchema>;
