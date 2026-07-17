import path from 'node:path';
import type { ProductionEffectProvenance } from './schemas/production-effect-provenance-schema';
import { supabaseHistoryReplayManifest as manifest } from './supabase-history-replay-manifest';

const HEX_64 = /^[a-f0-9]{64}$/;

function assertRepositoryPath(repositoryPath: string): void {
  if (
    repositoryPath.startsWith('/') ||
    repositoryPath.includes('\\') ||
    repositoryPath.split('/').includes('..') ||
    path.posix.normalize(repositoryPath) !== repositoryPath
  ) {
    throw new Error(`Unsafe repository path: ${repositoryPath}`);
  }
}

function addExpected(
  expected: Map<string, string>,
  repositoryPath: string,
  sourceSha: string
): void {
  assertRepositoryPath(repositoryPath);
  if (!HEX_64.test(sourceSha)) {
    throw new Error(`Invalid SHA-256 binding for ${repositoryPath}`);
  }
  const prior = expected.get(repositoryPath);
  if (prior && prior !== sourceSha) {
    throw new Error(`Conflicting SHA-256 bindings for ${repositoryPath}`);
  }
  expected.set(repositoryPath, sourceSha);
}

function jobEvidenceKey(evidence: {
  corroboration?: unknown;
  databaseJobId: number;
  deploymentRunId: number;
  headSha: string;
  jobConclusion: string;
  sanitizedJobLogSha256: string;
}): string {
  return JSON.stringify([
    evidence.databaseJobId,
    evidence.deploymentRunId,
    evidence.headSha,
    evidence.jobConclusion,
    evidence.sanitizedJobLogSha256,
    evidence.corroboration ?? null,
  ]);
}

function recordEvidenceKey(
  evidence: Parameters<typeof jobEvidenceKey>[0] & { logOrdinal: number }
): string {
  return JSON.stringify([jobEvidenceKey(evidence), evidence.logOrdinal]);
}

function verifyScalarBindings(provenance: ProductionEffectProvenance): void {
  if (
    provenance.baseSha !== manifest.baseSha ||
    provenance.schemaVersion !== manifest.provenance.schemaVersion ||
    provenance.exceptionalRecords.length !==
      manifest.provenance.exceptionalRecordCount ||
    provenance.evidenceSources.length !==
      manifest.provenance.evidenceSourceCount ||
    provenance.replayConstraints.relations.length !==
      manifest.provenance.relationCount
  ) {
    throw new Error('Production-effect provenance scalar binding drift');
  }
  if (
    provenance.exceptionalRecords.some(
      ({ recordOrdinal }, index) => recordOrdinal !== index + 1
    )
  ) {
    throw new Error(
      'Exceptional record ordinals must be contiguous and one-based'
    );
  }
  const pending = provenance.exceptionalRecords.filter(
    (record) => record.applied === null
  );
  if (
    pending.length !== 1 ||
    pending[0].repositoryOwnerPath !== manifest.repair.path ||
    pending[0].ownerSha256 !== manifest.repair.sha256 ||
    pending[0].mappingRule !== 'append-only-repair'
  ) {
    throw new Error('Pending repair provenance does not match the manifest');
  }
}

function verifyRecordBindings(
  provenance: ProductionEffectProvenance,
  expected: Map<string, string>
): Map<number, ProductionEffectProvenance['exceptionalRecords'][number]> {
  const records = new Map(
    provenance.exceptionalRecords.map((record) => [
      record.recordOrdinal,
      record,
    ])
  );
  const jobEvidenceKeys = new Set(
    provenance.evidenceSources.map(jobEvidenceKey)
  );
  const recordEvidenceKeys = new Set<string>();
  for (const record of provenance.exceptionalRecords) {
    if (record.applied === null) continue;
    addExpected(expected, record.repositoryOwnerPath, record.ownerSha256);
    if (!jobEvidenceKeys.has(jobEvidenceKey(record.evidence))) {
      throw new Error(
        `Exceptional record ${record.recordOrdinal} lacks exact primary evidence`
      );
    }
    const exactRecordEvidence = recordEvidenceKey(record.evidence);
    if (recordEvidenceKeys.has(exactRecordEvidence)) {
      throw new Error('Duplicate exact record evidence identity');
    }
    recordEvidenceKeys.add(exactRecordEvidence);
    if (
      record.evidence.jobConclusion === 'failure_after_applied_entry' &&
      !record.evidence.corroboration
    ) {
      throw new Error(
        `Exceptional record ${record.recordOrdinal} lacks corroboration`
      );
    }
  }
  const linkedRecords = provenance.exceptionalRecords.filter(
    (record): record is typeof record & { linkedVersion: string } =>
      'linkedVersion' in record
  );
  if (linkedRecords.length !== manifest.productionMappings.length) {
    throw new Error('Frozen linked production mapping count drift');
  }
  for (const mapping of manifest.productionMappings) {
    const record = linkedRecords.find(
      ({ linkedVersion }) => linkedVersion === mapping.productionVersion
    );
    if (
      !record ||
      record.repositoryOwnerPath !== mapping.repositoryPath ||
      record.ownerSha256 !== mapping.sha256 ||
      record.mappingRule !== mapping.rule
    ) {
      throw new Error(
        `Frozen linked mapping drift for ${mapping.productionVersion}`
      );
    }
  }
  return records;
}

function verifyConstraintBindings(
  provenance: ProductionEffectProvenance,
  expected: Map<string, string>,
  records: Map<number, ProductionEffectProvenance['exceptionalRecords'][number]>
): void {
  const jobGroups = new Set<string>();
  for (const group of provenance.replayConstraints.jobGroups) {
    jobGroups.add(`${group.deploymentRunId}:${group.databaseJobId}`);
    if ('pipelineRecords' in group) {
      for (const source of group.pipelineRecords) {
        addExpected(expected, source.repositoryOwnerPath, source.ownerSha256);
      }
      continue;
    }
    for (const included of group.includedRecords) {
      const record = records.get(included.recordOrdinal);
      if (
        !record ||
        record.applied === null ||
        record.evidence.logOrdinal !== included.logOrdinal ||
        record.evidence.deploymentRunId !== group.deploymentRunId ||
        record.evidence.databaseJobId !== group.databaseJobId
      ) {
        throw new Error('Job-group included record cross-reference drift');
      }
    }
  }

  const duplicateRelations = provenance.replayConstraints.relations.filter(
    (relation) => relation.kind === 'duplicate-version-companion'
  );
  const expectedDuplicateVersions = new Set<string>(
    manifest.duplicateGroups.map(({ version }) => version)
  );
  const relationVersions = duplicateRelations.map(
    ({ syntheticCompanion }) => syntheticCompanion.version
  );
  if (
    relationVersions.length !== expectedDuplicateVersions.size ||
    new Set(relationVersions).size !== expectedDuplicateVersions.size ||
    relationVersions.some((version) => !expectedDuplicateVersions.has(version))
  ) {
    throw new Error('Duplicate-version relation coverage drift');
  }
  for (const relation of provenance.replayConstraints.relations) {
    if (relation.kind === 'record-before-record') {
      if (
        !records.has(relation.beforeRecordOrdinal) ||
        !records.has(relation.afterRecordOrdinal)
      ) {
        throw new Error('Record-order relation cross-reference drift');
      }
      continue;
    }
    if (relation.kind === 'job-group-before-job-group') {
      const before = `${relation.before.deploymentRunId}:${relation.before.databaseJobId}`;
      const after = `${relation.after.deploymentRunId}:${relation.after.databaseJobId}`;
      if (!jobGroups.has(before) || !jobGroups.has(after)) {
        throw new Error('Job-group order relation cross-reference drift');
      }
      continue;
    }
    const owner = records.get(relation.ownerRecordOrdinal);
    const group = manifest.duplicateGroups.find(
      ({ version }) => version === relation.syntheticCompanion.version
    );
    if (
      !owner ||
      !group ||
      owner.applied?.version !== group.version ||
      !group.sources.some(
        ([sourcePath, sourceSha]) =>
          sourcePath === relation.syntheticCompanion.repositoryOwnerPath &&
          sourceSha === relation.syntheticCompanion.ownerSha256
      )
    ) {
      throw new Error('Duplicate-version companion cross-reference drift');
    }
    addExpected(
      expected,
      relation.syntheticCompanion.repositoryOwnerPath,
      relation.syntheticCompanion.ownerSha256
    );
    if ('replacementRecordOrdinal' in relation) {
      const replacement = records.get(relation.replacementRecordOrdinal);
      if (
        !('uniqueReapply' in group) ||
        !replacement ||
        replacement.applied === null ||
        replacement.repositoryOwnerPath !== group.uniqueReapply[0] ||
        replacement.ownerSha256 !== group.uniqueReapply[1]
      ) {
        throw new Error('Duplicate-version replacement cross-reference drift');
      }
    }
  }
}

export function buildVerifiedReplaySourceHashes(
  provenance: ProductionEffectProvenance
): ReadonlyMap<string, string> {
  verifyScalarBindings(provenance);
  const expected = new Map<string, string>();
  for (const repair of manifest.forwardRepairs) {
    addExpected(expected, repair.path, repair.sha256);
  }
  for (const source of manifest.pipelineSources) {
    addExpected(expected, source.repositoryPath, source.sha256);
  }
  for (const mapping of manifest.productionMappings) {
    if (mapping.rule !== 'append-only-repair') {
      addExpected(expected, mapping.repositoryPath, mapping.sha256);
    }
  }
  for (const group of manifest.duplicateGroups) {
    for (const [sourcePath, sourceSha] of group.sources) {
      addExpected(expected, sourcePath, sourceSha);
    }
    if ('uniqueReapply' in group) {
      addExpected(expected, group.uniqueReapply[0], group.uniqueReapply[1]);
    }
  }
  const records = verifyRecordBindings(provenance, expected);
  verifyConstraintBindings(provenance, expected, records);
  return expected;
}
