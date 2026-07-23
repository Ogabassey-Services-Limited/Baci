import { z } from 'zod';
import { productionEffectReplayConstraintsSchema } from './production-effect-replay-constraints-schema';

const positiveInteger = z.number().int().positive();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const gitSha = z.string().regex(/^[a-f0-9]{40}$/);
const migrationVersion = z.string().regex(/^\d{14}$/);
const migrationName = z.string().regex(/^[a-z0-9_]+$/);
const repositoryOwnerPath = z
  .string()
  .regex(/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/);

const appliedMigrationSchema = z
  .object({
    name: migrationName,
    version: migrationVersion,
  })
  .strict();

const corroborationSchema = z
  .object({
    databaseJobId: positiveInteger,
    deploymentRunId: positiveInteger,
    headSha: gitSha,
    kind: z.literal('later_success_already_applied'),
    sanitizedJobLogSha256: sha256,
  })
  .strict();

const jobConclusionSchema = z.enum(['success', 'failure_after_applied_entry']);

function corroborationMatchesConclusion(evidence: {
  corroboration?: unknown;
  jobConclusion: 'success' | 'failure_after_applied_entry';
}): boolean {
  return (
    (evidence.jobConclusion === 'failure_after_applied_entry') ===
    (evidence.corroboration !== undefined)
  );
}

const evidenceSourceSchema = z
  .object({
    corroboration: corroborationSchema.optional(),
    databaseJobId: positiveInteger,
    deploymentRunId: positiveInteger,
    headSha: gitSha,
    jobConclusion: jobConclusionSchema,
    sanitizedJobLogSha256: sha256,
  })
  .strict()
  .refine(corroborationMatchesConclusion);

const recordEvidenceSchema = z
  .object({
    corroboration: corroborationSchema.optional(),
    databaseJobId: positiveInteger,
    deploymentRunId: positiveInteger,
    headSha: gitSha,
    jobConclusion: jobConclusionSchema,
    logOrdinal: positiveInteger,
    sanitizedJobLogSha256: sha256,
  })
  .strict()
  .refine(corroborationMatchesConclusion);

const exceptionalKindSchema = z.enum([
  'duplicate_version_owner',
  'late_applied',
  'production_only_mapping',
  'supersession',
  'unique_reapply',
]);

const appliedExceptionalRecordFields = {
  applied: appliedMigrationSchema,
  evidence: recordEvidenceSchema,
  exceptionalKinds: z.array(exceptionalKindSchema).min(1),
  mappingRule: z.enum(['canonical', 'superseded-final-state']),
  ownerSha256: sha256,
  recordOrdinal: positiveInteger,
  repositoryOwnerPath,
};

const appliedExceptionalRecordSchema = z.union([
  z.object(appliedExceptionalRecordFields).strict(),
  z
    .object({
      ...appliedExceptionalRecordFields,
      linkedLedgerOrdinal: positiveInteger,
      linkedName: migrationName,
      linkedVersion: migrationVersion,
    })
    .strict(),
]);

const appliedRepairExceptionalRecordSchema = z
  .object({
    applied: z
      .object({
        name: z.literal('reconcile_order_fulfillment_timestamps'),
        version: z.literal('20260714225501'),
      })
      .strict(),
    evidence: recordEvidenceSchema,
    exceptionalKinds: z.tuple([z.literal('production_only_mapping')]),
    linkedLedgerOrdinal: z.literal(247),
    linkedName: z.literal('add_order_fulfillment_timestamps'),
    linkedProductionOnlyOrdinal: z.literal(247),
    linkedVersion: z.literal('20260629154903'),
    mappingRule: z.literal('append-only-repair'),
    ownerSha256: z.literal(
      '1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361'
    ),
    recordOrdinal: z.literal(31),
    repositoryOwnerPath: z.literal(
      'supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql'
    ),
  })
  .strict();

export const productionEffectProvenanceSchema = z
  .object({
    baseSha: z.literal('9e3d1b14b1931a5e441fc23f0e5417c188056e47'),
    coverage: z.literal('partial-order-effect-replay'),
    evidenceSources: z.array(evidenceSourceSchema).min(1),
    exceptionalRecordCount: positiveInteger,
    exceptionalRecords: z
      .array(
        z.union([
          appliedExceptionalRecordSchema,
          appliedRepairExceptionalRecordSchema,
        ])
      )
      .min(1),
    linkedLedger: z
      .object({
        historicalReplay: z
          .object({
            rowCount: z.literal(439),
            tailVersion: z.literal('20260714225500'),
          })
          .strict(),
        receipt: z
          .object({
            rowCount: z.literal(442),
            tailVersion: z.literal('20260714225503'),
          })
          .strict(),
      })
      .strict(),
    logSanitizer: z
      .object({
        markers: z.tuple([
          z.literal('→ applying:'),
          z.literal('✓ applied:'),
          z.literal('✓ already applied:'),
          z.literal('Migrations summary:'),
        ]),
        version: z.literal('github-actions-migration-semantic-lines-v1'),
      })
      .strict(),
    replayConstraints: productionEffectReplayConstraintsSchema,
    schemaVersion: z.literal(5),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.exceptionalRecordCount !== receipt.exceptionalRecords.length) {
      context.addIssue({
        code: 'custom',
        message: 'exceptionalRecordCount must match exceptionalRecords length',
        path: ['exceptionalRecordCount'],
      });
    }
    const seen = new Set<number>();
    receipt.exceptionalRecords.forEach((record, index) => {
      if (seen.has(record.recordOrdinal)) {
        context.addIssue({
          code: 'custom',
          message: 'recordOrdinal must be unique',
          path: ['exceptionalRecords', index, 'recordOrdinal'],
        });
      }
      seen.add(record.recordOrdinal);
    });
  });

export type ProductionEffectProvenance = z.infer<
  typeof productionEffectProvenanceSchema
>;
