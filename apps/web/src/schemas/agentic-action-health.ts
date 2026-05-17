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

export const agenticActionCheckoutSessionsSchema = z
  .object({
    claiming_payment_count: nonnegativeCountSchema.optional(),
    order_finalizing_count: nonnegativeCountSchema.optional(),
    payment_pending_count: nonnegativeCountSchema.optional(),
    payment_setup_failed_count: nonnegativeCountSchema.optional(),
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
export type AgenticActionHealthPayload = z.infer<
  typeof agenticActionHealthPayloadSchema
>;
export type AgenticActionSeverity = z.infer<typeof agenticActionSeveritySchema>;
