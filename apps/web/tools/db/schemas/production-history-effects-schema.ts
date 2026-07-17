import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalReplayEffectJson } from '../canonical-replay-effect-json';
import { supabaseHistoryEffectQueryContract } from '../supabase-history-effect-query-contract';
import { validateSupabaseHistoryEffectComponents } from '../validate-supabase-history-effect-components';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
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
const digestSchema = z
  .object({
    category: categorySchema,
    identity: z.string().min(1),
    sha256: sha256Schema,
  })
  .strict();
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
const effectsSchema = z
  .object({
    componentCount: z.literal(76),
    domainEventRpcCount: z.literal(19),
    eventPolicyRolesExact: z.literal(true),
    everyDomainEventProducerDisabled: z.literal(true),
    fulfillmentTimestampsReady: z.literal(true),
    customerCancellationSurfacePresent: z.literal(true),
    merchantAnonProjectionExact: z.literal(true),
    merchantFeatureSettingsReadWithheld: z.literal(true),
    pgmqDomainEventsQueuePresent: z.literal(true),
    pgmqProtectedRolesWithheld: z.literal(true),
    pgmqPublicSchemaAbsent: z.literal(true),
    requiredExtensionsPresent: z.literal(true),
  })
  .strict();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function digestIdentity(value: { category: string; identity: string }): string {
  return `${value.category}\0${value.identity}`;
}

function compareDigestIdentity(
  left: { category: string; identity: string },
  right: { category: string; identity: string }
): number {
  const leftKey = digestIdentity(left);
  const rightKey = digestIdentity(right);
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return 0;
}

export const productionHistoryEffectsSchema = z
  .object({
    schemaVersion: z.literal(2),
    baseSha: z.literal('9e3d1b14b1931a5e441fc23f0e5417c188056e47'),
    source: z
      .object({
        kind: z.literal('supabase-management-api-read-only'),
        querySha256: sha256Schema,
        serverVersionNum: z.literal(170006),
      })
      .strict(),
    scope: z
      .object({
        version: z.literal(supabaseHistoryEffectQueryContract.scopeVersion),
        manifestSha256: z.literal(
          supabaseHistoryEffectQueryContract.scopeManifestSha256
        ),
        componentCount: z.literal(76),
      })
      .strict(),
    diagnostics: z
      .object({
        extensionVersions: extensionVersionsSchema,
      })
      .strict(),
    ledger: z
      .object({
        rowCount: z.literal(439),
        tailVersion: z.literal('20260714225500'),
      })
      .strict(),
    digestVector: z.array(digestSchema).length(76),
    effectSha256: sha256Schema,
    effects: effectsSchema,
  })
  .strict()
  .superRefine((fixture, context) => {
    const ordered = [...fixture.digestVector].sort(compareDigestIdentity);
    if (
      canonicalReplayEffectJson(ordered) !==
      canonicalReplayEffectJson(fixture.digestVector)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'effect digest vector order mismatch',
        path: ['digestVector'],
      });
    }
    try {
      validateSupabaseHistoryEffectComponents(
        fixture.digestVector.map(({ category, identity }) => ({
          category,
          identity,
          value: {},
        }))
      );
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'effect digest vector scope mismatch',
        path: ['digestVector'],
      });
    }
    if (
      fixture.effectSha256 !==
      sha256(canonicalReplayEffectJson(fixture.digestVector))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'effect digest vector hash mismatch',
        path: ['effectSha256'],
      });
    }
  });

export type ProductionHistoryEffects = z.infer<
  typeof productionHistoryEffectsSchema
>;
