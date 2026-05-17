import { z } from 'zod';

const nonnegativeCountSchema = z.number().int().nonnegative();

export const agenticActionSeveritySchema = z.enum([
  'attention',
  'monitor',
  'ok',
]);

export const agenticActionIdempotencyStateSchema = z.enum([
  'in_progress',
  'server_error',
  'client_error',
  'completed',
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

export const agenticActionIdempotencyRecordSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
  route: z.string().trim().min(1),
  state: agenticActionIdempotencyStateSchema,
  status_code: z.number().int().nullable(),
  updated_at: z.string().datetime({ offset: true }),
});

export const agenticActionIdempotencySchema = z
  .object({
    active_in_progress_count: nonnegativeCountSchema.optional(),
    in_progress_count: nonnegativeCountSchema.optional(),
    recent_count: nonnegativeCountSchema.optional(),
    records: z.array(agenticActionIdempotencyRecordSchema).optional(),
    stale_in_progress_count: nonnegativeCountSchema.optional(),
    terminal_error_count: nonnegativeCountSchema.optional(),
  })
  .passthrough();

export const agenticActionHealthPayloadSchema = z
  .object({
    actions: z.array(agenticActionSchema),
    checkout_sessions: agenticActionCheckoutSessionsSchema.optional(),
    generated_at: z.string().datetime().optional(),
    idempotency: agenticActionIdempotencySchema.optional(),
  })
  .passthrough();

export type AgenticAction = z.infer<typeof agenticActionSchema>;
export type AgenticActionCheckoutSessionRecord = z.infer<
  typeof agenticActionCheckoutSessionRecordSchema
>;
export type AgenticActionIdempotencyRecord = z.infer<
  typeof agenticActionIdempotencyRecordSchema
>;
export type AgenticActionHealthPayload = z.infer<
  typeof agenticActionHealthPayloadSchema
>;
export type AgenticActionSeverity = z.infer<typeof agenticActionSeveritySchema>;
