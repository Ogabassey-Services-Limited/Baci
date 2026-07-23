import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { productionEffectReplayConstraintsSchema } from './production-effect-replay-constraints-schema';

async function constraints() {
  const fixture = JSON.parse(
    await readFile(
      path.resolve(
        import.meta.dirname,
        '../fixtures/production-effect-provenance.json'
      ),
      'utf8'
    )
  ) as { replayConstraints: Record<string, unknown> };
  return structuredClone(fixture.replayConstraints) as {
    jobGroups: Record<string, unknown>[];
    relations: Record<string, unknown>[];
  };
}

describe('productionEffectReplayConstraintsSchema', () => {
  it('binds the complete post-deploy repair job and its ordering relation', async () => {
    const value = await constraints();
    const parsed = productionEffectReplayConstraintsSchema.parse(value);

    expect(parsed.jobGroups.at(-1)).toMatchObject({
      databaseJobId: 87824630957,
      deploymentRunId: 29561460438,
      observedMigrationEntryCount: 3,
    });
    expect(parsed.relations.at(-1)).toMatchObject({
      after: { databaseJobId: 87824630957, deploymentRunId: 29561460438 },
      before: { databaseJobId: 87358367070, deploymentRunId: 29417244012 },
      kind: 'job-group-before-job-group',
    });
  });

  it('rejects duplicate job groups with the same run and job identity', async () => {
    const value = await constraints();
    value.jobGroups.push(structuredClone(value.jobGroups.at(-1)) ?? {});

    expect(() => productionEffectReplayConstraintsSchema.parse(value)).toThrow(
      /duplicate job group/i
    );
  });

  it('requires exactly one complete deployment repair job group', async () => {
    const value = await constraints();
    value.jobGroups = value.jobGroups.filter(
      (group) => group.coverage !== 'complete-deployment-repair-log-group'
    );

    expect(() => productionEffectReplayConstraintsSchema.parse(value)).toThrow(
      /exactly one complete deployment repair/i
    );
  });

  it('rejects duplicate relations with the same semantic identity', async () => {
    const value = await constraints();
    value.relations.push(structuredClone(value.relations.at(-1)) ?? {});

    expect(() => productionEffectReplayConstraintsSchema.parse(value)).toThrow(
      /duplicate relation/i
    );
  });

  it('rejects duplicate record and log identities inside included-record groups', async () => {
    for (const field of ['logOrdinal', 'recordOrdinal'] as const) {
      const value = await constraints();
      const group = value.jobGroups.find(
        (candidate) =>
          Array.isArray(candidate.includedRecords) &&
          candidate.includedRecords.length > 1 &&
          candidate.coverage === 'complete-primary-log-group'
      );
      if (!group || !Array.isArray(group.includedRecords)) {
        throw new Error('Expected complete included-record group');
      }
      const first = group.includedRecords[0] as Record<string, unknown>;
      const second = group.includedRecords[1] as Record<string, unknown>;
      second[field] = first[field];

      expect(() =>
        productionEffectReplayConstraintsSchema.parse(value)
      ).toThrow(new RegExp(`duplicate included-record ${field}`, 'i'));
    }
  });

  it('rejects duplicate source and log identities inside pipeline groups', async () => {
    for (const field of ['logOrdinal', 'repositoryOwnerPath'] as const) {
      const value = await constraints();
      const group = value.jobGroups.find(
        (candidate) =>
          Array.isArray(candidate.pipelineRecords) &&
          candidate.pipelineRecords.length > 1
      );
      if (!group || !Array.isArray(group.pipelineRecords)) {
        throw new Error('Expected pipeline-record group');
      }
      const first = group.pipelineRecords[0] as Record<string, unknown>;
      const second = group.pipelineRecords[1] as Record<string, unknown>;
      second[field] = first[field];

      expect(() =>
        productionEffectReplayConstraintsSchema.parse(value)
      ).toThrow(new RegExp(`duplicate pipeline-record ${field}`, 'i'));
    }
  });

  it('rejects included-record log ordinals beyond the observed migration entries', async () => {
    for (const coverage of [
      'complete-primary-log-group',
      'partial-primary-log-constraint',
    ]) {
      const value = await constraints();
      const group = value.jobGroups.find(
        (candidate) =>
          candidate.coverage === coverage &&
          Array.isArray(candidate.includedRecords)
      );
      if (
        !group ||
        !Array.isArray(group.includedRecords) ||
        typeof group.observedMigrationEntryCount !== 'number'
      ) {
        throw new Error(`Expected ${coverage} included-record group`);
      }
      const record = group.includedRecords[0] as Record<string, unknown>;
      record.logOrdinal = group.observedMigrationEntryCount + 1;

      expect(() =>
        productionEffectReplayConstraintsSchema.parse(value)
      ).toThrow(/included-record logOrdinal coverage/i);
    }
  });

  it('rejects pipeline-record log ordinals beyond the observed migration entries', async () => {
    const value = await constraints();
    const group = value.jobGroups.find((candidate) =>
      Array.isArray(candidate.pipelineRecords)
    );
    if (
      !group ||
      !Array.isArray(group.pipelineRecords) ||
      typeof group.observedMigrationEntryCount !== 'number'
    ) {
      throw new Error('Expected pipeline-record group');
    }
    const record = group.pipelineRecords.at(-1) as Record<string, unknown>;
    record.logOrdinal = group.observedMigrationEntryCount + 1;

    expect(() => productionEffectReplayConstraintsSchema.parse(value)).toThrow(
      /pipeline-record logOrdinal coverage/i
    );
  });

  it('rejects a pipeline migration identity that disagrees with its owner path', async () => {
    const value = await constraints();
    const group = value.jobGroups.find((candidate) =>
      Array.isArray(candidate.pipelineRecords)
    );
    if (!group || !Array.isArray(group.pipelineRecords)) {
      throw new Error('Expected pipeline-record group');
    }
    const record = group.pipelineRecords[0] as {
      applied: { name: string };
    };
    record.applied.name = 'wrong_migration_name';

    expect(() => productionEffectReplayConstraintsSchema.parse(value)).toThrow(
      /repositoryOwnerPath must match the migration version and name/i
    );
  });

  it('rejects a synthetic companion identity that disagrees with its owner path', async () => {
    const value = await constraints();
    const relation = value.relations.find(
      (candidate) => candidate.kind === 'duplicate-version-companion'
    );
    if (!relation || typeof relation.syntheticCompanion !== 'object') {
      throw new Error('Expected duplicate-version companion relation');
    }
    const companion = relation.syntheticCompanion as { version: string };
    companion.version = '20260615120001';

    expect(() => productionEffectReplayConstraintsSchema.parse(value)).toThrow(
      /repositoryOwnerPath must match the migration version and name/i
    );
  });

  it('rejects an incomplete or renumbered post-deploy repair job', async () => {
    const value = await constraints();
    const repairGroup = value.jobGroups.find(
      (group) => group.coverage === 'complete-deployment-repair-log-group'
    );
    if (!repairGroup) throw new Error('Expected deployment repair group');
    repairGroup.forwardRepairReceiptLogOrdinals = [1, 2];

    expect(() =>
      productionEffectReplayConstraintsSchema.parse(value)
    ).toThrow();
  });
});
