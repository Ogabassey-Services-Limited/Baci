import { z } from 'zod';

const repairSchema = z
  .object({
    changedComponent: z
      .object({
        category: z.literal('function'),
        identity: z.string().min(1),
      })
      .strict(),
    logOrdinal: z.union([z.literal(2), z.literal(3)]),
    manifestOrdinal: z.union([z.literal(1), z.literal(2)]),
    migration: z
      .object({
        name: z.string().regex(/^[a-z0-9_]+$/),
        version: z.string().regex(/^\d{14}$/),
      })
      .strict(),
    path: z.string().regex(/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const forwardRepairDeploymentReceiptSchema = z
  .object({
    deployment: z
      .object({
        databaseJobId: z.literal(87824630957),
        headSha: z.literal('bb55d407e01b719a9014c87fb8a8253861b7005d'),
        jobConclusion: z.literal('success'),
        observedMigrationEntryCount: z.literal(3),
        runId: z.literal(29561460438),
        sanitizedJobLogSha256: z.literal(
          '400990a8ee41f6550b609795b02c6e8090d9c056941ab488d5cee0a2fdfc8af1'
        ),
        summary: z
          .object({ applied: z.literal(3), skipped: z.literal(424) })
          .strict(),
      })
      .strict(),
    release: z
      .object({
        mergeSha: z.literal('bb55d407e01b719a9014c87fb8a8253861b7005d'),
        pullRequestHeadSha: z.literal(
          '71f262a8254bf0087cb8f630e82b421feb7dfc0f'
        ),
        pullRequestNumber: z.literal(3131),
      })
      .strict(),
    repairs: z.tuple([
      repairSchema.extend({
        changedComponent: z
          .object({
            category: z.literal('function'),
            identity: z.literal(
              'eventing.resolve_domain_event_duplicate_v1(p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_data jsonb)'
            ),
          })
          .strict(),
        logOrdinal: z.literal(2),
        manifestOrdinal: z.literal(1),
        migration: z
          .object({
            name: z.literal('reconcile_domain_event_duplicate_jsonb_operator'),
            version: z.literal('20260714225502'),
          })
          .strict(),
        path: z.literal(
          'supabase/migrations/20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql'
        ),
        sha256: z.literal(
          '537f5654e8ca811d926fe0642d410e13c13c39703bba8a7d18372a8000784263'
        ),
      }),
      repairSchema.extend({
        changedComponent: z
          .object({
            category: z.literal('function'),
            identity: z.literal(
              'public.cancel_order_as_customer(p_order_id uuid, p_reason text)'
            ),
          })
          .strict(),
        logOrdinal: z.literal(3),
        manifestOrdinal: z.literal(2),
        migration: z
          .object({
            name: z.literal('reconcile_customer_order_cancellation_reason'),
            version: z.literal('20260714225503'),
          })
          .strict(),
        path: z.literal(
          'supabase/migrations/20260714225503_reconcile_customer_order_cancellation_reason.sql'
        ),
        sha256: z.literal(
          '6c5f9ca9ed75b63e241f25e1dddfab9b2d7da1bab7cb91694b92a1d9548d7a71'
        ),
      }),
    ]),
    repository: z.literal('ogabasseyy/Baci'),
    schemaVersion: z.literal(1),
  })
  .strict();

export type ForwardRepairDeploymentReceipt = z.infer<
  typeof forwardRepairDeploymentReceiptSchema
>;
