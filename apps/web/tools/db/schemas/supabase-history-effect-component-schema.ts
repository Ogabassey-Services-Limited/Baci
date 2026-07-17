import { z } from 'zod';

const categorySchema = z.enum([
  'constraint',
  'event-relation',
  'extension',
  'function',
  'grant-vector',
  'index',
  'pgmq-access',
  'pgmq-queue',
  'policy',
  'producer-config',
  'relation-security',
  'schema-presence',
  'selected-column',
  'trigger',
]);

export const supabaseHistoryEffectComponentSchema = z
  .object({
    category: categorySchema,
    identity: z.string().min(1),
    value: z.record(z.string(), z.json()),
  })
  .strict();

export type SupabaseHistoryEffectComponent = z.infer<
  typeof supabaseHistoryEffectComponentSchema
>;
