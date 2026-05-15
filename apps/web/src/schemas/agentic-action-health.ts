import { z } from 'zod';

export const agenticActionSeveritySchema = z.enum([
  'attention',
  'monitor',
  'ok',
]);

export const agenticActionSchema = z.object({
  code: z.string(),
  count: z.number().int().nonnegative(),
  message: z.string(),
  severity: agenticActionSeveritySchema,
});

export const agenticActionHealthPayloadSchema = z
  .object({
    actions: z.array(agenticActionSchema),
    generated_at: z.string().datetime().optional(),
  })
  .passthrough();

export type AgenticAction = z.infer<typeof agenticActionSchema>;
export type AgenticActionHealthPayload = z.infer<
  typeof agenticActionHealthPayloadSchema
>;
export type AgenticActionSeverity = z.infer<typeof agenticActionSeveritySchema>;
