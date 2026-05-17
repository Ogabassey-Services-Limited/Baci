import { z } from 'zod';

const nonnegativeCountSchema = z.number().int().nonnegative();

export const agenticActionSeveritySchema = z.enum([
  'attention',
  'monitor',
  'ok',
]);

export const agenticActionSchema = z.object({
  code: z.string(),
  count: nonnegativeCountSchema,
  message: z.string(),
  next_step: z.string().trim().min(1).optional(),
  next_step_url: z.string().trim().min(1).optional(),
  severity: agenticActionSeveritySchema,
});

export const agenticActionCheckoutSessionRecordSchema = z.object({
  payment_state: z.string().trim().min(1),
  session_id: z.string().trim().min(1),
  status: z.string().trim().min(1),
  updated_at: z.string().datetime({ offset: true }),
});

export const agenticActionCheckoutSessionsSchema = z
  .object({
    claiming_payment_count: nonnegativeCountSchema.optional(),
    order_finalizing_count: nonnegativeCountSchema.optional(),
    payment_pending_count: nonnegativeCountSchema.optional(),
    payment_setup_failed_count: nonnegativeCountSchema.optional(),
    records: z.array(agenticActionCheckoutSessionRecordSchema).optional(),
    recent_count: nonnegativeCountSchema.optional(),
    stale_payment_pending_count: nonnegativeCountSchema.optional(),
  })
  .passthrough();

export const agenticActionHealthPayloadSchema = z
  .object({
    actions: z.array(agenticActionSchema),
    checkout_sessions: agenticActionCheckoutSessionsSchema.optional(),
    generated_at: z.string().datetime().optional(),
  })
  .passthrough();

export type AgenticAction = z.infer<typeof agenticActionSchema>;
export type AgenticActionCheckoutSessionRecord = z.infer<
  typeof agenticActionCheckoutSessionRecordSchema
>;
export type AgenticActionHealthPayload = z.infer<
  typeof agenticActionHealthPayloadSchema
>;
export type AgenticActionSeverity = z.infer<typeof agenticActionSeveritySchema>;
