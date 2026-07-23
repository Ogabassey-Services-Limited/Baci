import { z } from 'zod';

const positiveInteger = z.number().int().positive();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const gitSha = z.string().regex(/^[a-f0-9]{40}$/);
const migrationVersion = z.string().regex(/^\d{14}$/);
const migrationName = z.string().regex(/^[a-z0-9_]+$/);

const newlyAppliedMigrationSchema = z
  .object({
    name: migrationName,
    ownerSha256: sha256,
    repositoryOwnerPath: z
      .string()
      .regex(/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/),
    version: migrationVersion,
  })
  .strict();

export const migrationNameAliasDeployRepairSchema = z
  .object({
    alias: z
      .object({
        disposition: z.literal('already-applied-no-ledger-write'),
        recordedName: migrationName,
        repositoryName: migrationName,
        version: migrationVersion,
      })
      .strict(),
    baseSha: gitSha,
    failedPreRepairAttempt: z
      .object({
        conclusion: z.literal('failure'),
        databaseJobId: positiveInteger,
        deploymentRunId: positiveInteger,
        diagnosticLineSha256: sha256,
        headSha: gitSha,
      })
      .strict(),
    provenanceTreatment: z.literal(
      'deploy-repair-only-not-production-effect-exceptional-record'
    ),
    receiptKind: z.literal('same-version-name-alias-deploy-repair'),
    repairCommitSha: gitSha,
    schemaVersion: z.literal(1),
    successfulRepairAttempt: z
      .object({
        aliasLineSha256: sha256,
        conclusion: z.literal('success'),
        databaseJobId: positiveInteger,
        deploymentRunId: positiveInteger,
        headSha: gitSha,
        migrationSummary: z
          .object({
            applied: z.number().int().nonnegative(),
            skipped: z.number().int().nonnegative(),
          })
          .strict(),
        newlyAppliedMigration: newlyAppliedMigrationSchema,
        semanticJobLogSha256: sha256,
      })
      .strict(),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.baseSha !== receipt.repairCommitSha) {
      context.addIssue({
        code: 'custom',
        message: 'baseSha and repairCommitSha must match',
        path: ['repairCommitSha'],
      });
    }
    const newlyAppliedMigration =
      receipt.successfulRepairAttempt.newlyAppliedMigration;
    const expectedRepositoryOwnerPath = `supabase/migrations/${newlyAppliedMigration.version}_${newlyAppliedMigration.name}.sql`;
    if (
      newlyAppliedMigration.repositoryOwnerPath !== expectedRepositoryOwnerPath
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'repositoryOwnerPath must match the migration version and name',
        path: [
          'successfulRepairAttempt',
          'newlyAppliedMigration',
          'repositoryOwnerPath',
        ],
      });
    }
    if (receipt.alias.recordedName === receipt.alias.repositoryName) {
      context.addIssue({
        code: 'custom',
        message: 'recordedName and repositoryName must differ',
        path: ['alias', 'repositoryName'],
      });
    }
    if (receipt.successfulRepairAttempt.headSha !== receipt.repairCommitSha) {
      context.addIssue({
        code: 'custom',
        message: 'successfulRepairAttempt.headSha must match repairCommitSha',
        path: ['successfulRepairAttempt', 'headSha'],
      });
    }
  });

export type MigrationNameAliasDeployRepair = z.infer<
  typeof migrationNameAliasDeployRepairSchema
>;
