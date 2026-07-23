import { z } from 'zod';

const positiveInteger = z.number().int().positive();
const migrationVersion = z.string().regex(/^\d{14}$/);
const migrationName = z.string().regex(/^[a-z0-9_]+$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const repositoryOwnerPath = z
  .string()
  .regex(/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/);

function expectedRepositoryOwnerPath(identity: {
  name: string;
  version: string;
}): string {
  return `supabase/migrations/${identity.version}_${identity.name}.sql`;
}

const appliedMigrationSchema = z
  .object({ name: migrationName, version: migrationVersion })
  .strict();
const includedRecordSchema = z
  .object({
    logOrdinal: positiveInteger,
    recordOrdinal: positiveInteger,
  })
  .strict();
const includedRecordJobGroupSchema = z
  .object({
    coverage: z.enum([
      'complete-primary-log-group',
      'partial-primary-log-constraint',
    ]),
    databaseJobId: positiveInteger,
    deploymentRunId: positiveInteger,
    includedRecords: z.array(includedRecordSchema).min(1),
    observedMigrationEntryCount: positiveInteger,
  })
  .strict()
  .superRefine((group, context) => {
    const uniqueLogCount = uniqueIdentityCount(
      group.includedRecords,
      ({ logOrdinal }) => String(logOrdinal)
    );
    const uniqueRecordCount = uniqueIdentityCount(
      group.includedRecords,
      ({ recordOrdinal }) => String(recordOrdinal)
    );
    if (uniqueLogCount !== group.includedRecords.length) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate included-record logOrdinal',
        path: ['includedRecords'],
      });
    }
    if (uniqueRecordCount !== group.includedRecords.length) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate included-record recordOrdinal',
        path: ['includedRecords'],
      });
    }
    const logOrdinalCoverageMatches =
      group.includedRecords.every(
        ({ logOrdinal }) => logOrdinal <= group.observedMigrationEntryCount
      ) &&
      (group.coverage === 'complete-primary-log-group'
        ? uniqueLogCount === group.observedMigrationEntryCount
        : uniqueLogCount < group.observedMigrationEntryCount);
    if (!logOrdinalCoverageMatches) {
      context.addIssue({
        code: 'custom',
        message: 'Included-record logOrdinal coverage mismatch',
        path: ['observedMigrationEntryCount'],
      });
    }
  });
const deploymentRepairJobGroupSchema = z
  .object({
    coverage: z.literal('complete-deployment-repair-log-group'),
    databaseJobId: z.literal(87824630957),
    deploymentRunId: z.literal(29561460438),
    forwardRepairReceiptLogOrdinals: z.tuple([z.literal(2), z.literal(3)]),
    includedRecords: z.tuple([
      z
        .object({
          logOrdinal: z.literal(1),
          recordOrdinal: z.literal(31),
        })
        .strict(),
    ]),
    observedMigrationEntryCount: z.literal(3),
  })
  .strict();
const pipelineRecordSchema = z
  .object({
    applied: appliedMigrationSchema,
    logOrdinal: positiveInteger,
    ownerSha256: sha256,
    repositoryOwnerPath,
  })
  .strict()
  .refine(
    (record) =>
      record.repositoryOwnerPath ===
      expectedRepositoryOwnerPath(record.applied),
    {
      message: 'repositoryOwnerPath must match the migration version and name',
      path: ['repositoryOwnerPath'],
    }
  );
const pipelineJobGroupSchema = z
  .object({
    coverage: z.literal('complete-primary-log-group'),
    databaseJobId: positiveInteger,
    deploymentRunId: positiveInteger,
    observedMigrationEntryCount: positiveInteger,
    pipelineRecords: z.array(pipelineRecordSchema).min(1),
  })
  .strict()
  .superRefine((group, context) => {
    const uniqueLogCount = uniqueIdentityCount(
      group.pipelineRecords,
      ({ logOrdinal }) => String(logOrdinal)
    );
    const uniqueSourceCount = uniqueIdentityCount(
      group.pipelineRecords,
      ({ repositoryOwnerPath: sourcePath }) => sourcePath
    );
    if (uniqueLogCount !== group.pipelineRecords.length) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate pipeline-record logOrdinal',
        path: ['pipelineRecords'],
      });
    }
    if (uniqueSourceCount !== group.pipelineRecords.length) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate pipeline-record repositoryOwnerPath',
        path: ['pipelineRecords'],
      });
    }
    if (uniqueSourceCount !== group.observedMigrationEntryCount) {
      context.addIssue({
        code: 'custom',
        message: 'Pipeline-record coverage count mismatch',
        path: ['observedMigrationEntryCount'],
      });
    }
    if (
      uniqueLogCount !== group.observedMigrationEntryCount ||
      group.pipelineRecords.some(
        ({ logOrdinal }) => logOrdinal > group.observedMigrationEntryCount
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Pipeline-record logOrdinal coverage mismatch',
        path: ['observedMigrationEntryCount'],
      });
    }
  });
const syntheticCompanionSchema = appliedMigrationSchema
  .extend({
    ownerSha256: sha256,
    repositoryOwnerPath,
  })
  .refine(
    (companion) =>
      companion.repositoryOwnerPath === expectedRepositoryOwnerPath(companion),
    {
      message: 'repositoryOwnerPath must match the migration version and name',
      path: ['repositoryOwnerPath'],
    }
  );
const duplicateCompanionRelationSchema = z.union([
  z
    .object({
      kind: z.literal('duplicate-version-companion'),
      ownerRecordOrdinal: positiveInteger,
      replayDisposition: z.literal(
        'apply-synthetic-companion-immediately-after-owner'
      ),
      syntheticCompanion: syntheticCompanionSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('duplicate-version-companion'),
      ownerRecordOrdinal: positiveInteger,
      replacementRecordOrdinal: positiveInteger,
      replayDisposition: z.literal('omit-colliding-body-use-unique-reapply'),
      syntheticCompanion: syntheticCompanionSchema,
    })
    .strict(),
]);
const recordOrderRelationSchema = z
  .object({
    afterRecordOrdinal: positiveInteger,
    beforeRecordOrdinal: positiveInteger,
    kind: z.literal('record-before-record'),
    reason: z.string().min(1),
  })
  .strict();
const jobReferenceSchema = z
  .object({
    databaseJobId: positiveInteger,
    deploymentRunId: positiveInteger,
  })
  .strict();
const jobGroupOrderRelationSchema = z
  .object({
    after: jobReferenceSchema,
    before: jobReferenceSchema,
    kind: z.literal('job-group-before-job-group'),
    reason: z.string().min(1),
  })
  .strict();

function uniqueIdentityCount<T>(
  values: readonly T[],
  identity: (value: T) => string
): number {
  return new Set(values.map(identity)).size;
}

function relationIdentity(
  relation:
    | z.infer<typeof duplicateCompanionRelationSchema>
    | z.infer<typeof recordOrderRelationSchema>
    | z.infer<typeof jobGroupOrderRelationSchema>
): string {
  if (relation.kind === 'duplicate-version-companion') {
    return `${relation.kind}:${relation.ownerRecordOrdinal}`;
  }
  if (relation.kind === 'record-before-record') {
    return `${relation.kind}:${relation.beforeRecordOrdinal}:${relation.afterRecordOrdinal}`;
  }
  return `${relation.kind}:${relation.before.deploymentRunId}:${relation.before.databaseJobId}:${relation.after.deploymentRunId}:${relation.after.databaseJobId}`;
}

export const productionEffectReplayConstraintsSchema = z
  .object({
    coverage: z.literal('partial-order-effect-replay'),
    jobGroups: z
      .array(
        z.union([
          includedRecordJobGroupSchema,
          pipelineJobGroupSchema,
          deploymentRepairJobGroupSchema,
        ])
      )
      .min(1),
    registryOrdering: z.literal('repositoryOwnerPath-ascending'),
    relations: z
      .array(
        z.union([
          duplicateCompanionRelationSchema,
          recordOrderRelationSchema,
          jobGroupOrderRelationSchema,
        ])
      )
      .min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.jobGroups.filter(
        (group) => group.coverage === 'complete-deployment-repair-log-group'
      ).length !== 1
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Exactly one complete deployment repair job group is required',
        path: ['jobGroups'],
      });
    }
    if (
      uniqueIdentityCount(
        value.jobGroups,
        (group) => `${group.deploymentRunId}:${group.databaseJobId}`
      ) !== value.jobGroups.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate job group identity',
        path: ['jobGroups'],
      });
    }
    if (
      uniqueIdentityCount(value.relations, relationIdentity) !==
      value.relations.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Duplicate relation identity',
        path: ['relations'],
      });
    }
  });
