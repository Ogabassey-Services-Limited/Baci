import { z } from 'zod';
import { supabaseHistoryEffectQueryContract } from '../supabase-history-effect-query-contract';
import { supabaseHistoryEffectComponentSchema } from './supabase-history-effect-component-schema';

const extensionVersionsSchema = z.tuple([
  z
    .object({
      name: z.literal('pgcrypto'),
      schema: z.literal('extensions'),
      version: z.string().min(1),
    })
    .strict(),
  z
    .object({
      name: z.literal('pgmq'),
      schema: z.literal('pgmq'),
      version: z.string().min(1),
    })
    .strict(),
]);

export const supabaseHistoryEffectSnapshotSchema = z
  .object({
    scopeVersion: z.literal(supabaseHistoryEffectQueryContract.scopeVersion),
    serverVersionNum: z.literal(170006),
    components: z.array(supabaseHistoryEffectComponentSchema),
    diagnostics: z
      .object({
        extensionVersions: extensionVersionsSchema,
      })
      .strict(),
  })
  .strict();

export type SupabaseHistoryEffectSnapshot = z.infer<
  typeof supabaseHistoryEffectSnapshotSchema
>;
