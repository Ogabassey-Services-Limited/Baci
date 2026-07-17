import path from 'node:path';
import { compareCodeUnitStrings } from './compare-code-unit-strings';
import { stableReplayTopologicalSort } from './stable-replay-topological-sort';
import type {
  ReplaySource,
  SupabaseHistoryReplayMode,
  VerifiedReplayManifest,
} from './supabase-history-replay-types';

type ReplayBlock = {
  sortKey: string;
  sources: ReplaySource[];
};
const filename = (source: ReplaySource) =>
  path.posix.basename(source.repositoryPath);

function historicalChronologicalSources(
  verified: VerifiedReplayManifest
): ReplaySource[] {
  const sources = [...verified.verifiedSources];
  if (verified.pendingRepairState === 'materialized') {
    sources.push({
      receiptId: `repair:${verified.manifest.repair.path}`,
      repositoryPath: verified.manifest.repair.path,
      sha256: verified.manifest.repair.sha256,
    });
  }
  return sources.sort((left, right) => {
    const leftName = filename(left);
    const rightName = filename(right);
    return (
      compareCodeUnitStrings(leftName.slice(0, 14), rightName.slice(0, 14)) ||
      compareCodeUnitStrings(leftName, rightName)
    );
  });
}

function forwardRepairSources(
  verified: VerifiedReplayManifest
): ReplaySource[] {
  return verified.manifest.forwardRepairs.map((repair) => ({
    receiptId: `forward-repair:${repair.path}`,
    repositoryPath: repair.path,
    sha256: repair.sha256,
  }));
}

function productionEffectSources(
  verified: VerifiedReplayManifest
): ReplaySource[] {
  const provenance = verified.productionEffectProvenance;
  const records = new Map(
    provenance.exceptionalRecords.map((record) => [
      record.recordOrdinal,
      record,
    ])
  );
  const duplicateRelations = provenance.replayConstraints.relations.filter(
    (relation) => relation.kind === 'duplicate-version-companion'
  );
  const adjacentRelations = duplicateRelations.filter(
    (relation) =>
      relation.replayDisposition ===
      'apply-synthetic-companion-immediately-after-owner'
  );
  const adjacent = adjacentRelations[0];
  if (
    adjacentRelations.length !== 1 ||
    !adjacent ||
    adjacent.ownerRecordOrdinal !== 1 ||
    adjacent.syntheticCompanion.name !== 'customer_order_cancellation' ||
    adjacent.syntheticCompanion.version !== '20260615120000' ||
    adjacent.syntheticCompanion.repositoryOwnerPath !==
      'supabase/migrations/20260615120000_customer_order_cancellation.sql' ||
    adjacent.syntheticCompanion.ownerSha256 !==
      'acb7406d4975c5cd8d3964e86b991b51046b6f750d49b3769699b878b92192d3'
  ) {
    throw new Error('immediate replay companion relation drift');
  }
  const omitted = new Set(
    duplicateRelations
      .filter(
        (relation) =>
          relation.replayDisposition ===
          'omit-colliding-body-use-unique-reapply'
      )
      .map(({ syntheticCompanion }) => syntheticCompanion.repositoryOwnerPath)
  );
  const sourceByPath = new Map(
    historicalChronologicalSources(verified).map((source) => [
      source.repositoryPath,
      source,
    ])
  );
  const mappedRecords = provenance.exceptionalRecords.filter(
    (record) => 'linkedVersion' in record
  );
  const mappedVersionByPath = new Map(
    mappedRecords.map((record) => [
      record.repositoryOwnerPath,
      record.linkedVersion,
    ])
  );
  if (mappedRecords.length !== verified.manifest.productionMappings.length) {
    throw new Error('production mapping splice coverage drift');
  }
  for (const mapping of verified.manifest.productionMappings) {
    const record = mappedRecords.find(
      ({ linkedVersion }) => linkedVersion === mapping.productionVersion
    );
    if (
      !record ||
      record.repositoryOwnerPath !== mapping.repositoryPath ||
      record.ownerSha256 !== mapping.sha256 ||
      record.mappingRule !== mapping.rule
    ) {
      throw new Error('production mapping splice binding drift');
    }
  }
  const productionVersions = [
    ...new Set([
      ...verified.verifiedSources.map((source) =>
        filename(source).slice(0, 14)
      ),
      ...mappedRecords.map(({ linkedVersion }) => linkedVersion),
    ]),
  ].sort();
  if (productionVersions.length !== 439) {
    throw new Error('production linked-ledger registry drift');
  }
  const productionOrdinal = new Map(
    productionVersions.map((version, index) => [version, index + 1])
  );
  for (const record of mappedRecords) {
    if (
      productionOrdinal.get(record.linkedVersion) !==
        record.linkedLedgerOrdinal ||
      ('linkedProductionOnlyOrdinal' in record &&
        record.linkedProductionOnlyOrdinal !== record.linkedLedgerOrdinal)
    ) {
      throw new Error('production linked-ledger splice drift');
    }
  }
  const sourceSortKey = (source: ReplaySource): string => {
    const version =
      mappedVersionByPath.get(source.repositoryPath) ??
      filename(source).slice(0, 14);
    const ordinal = productionOrdinal.get(version);
    if (!ordinal) throw new Error('unknown production linked-ledger version');
    return `${String(ordinal).padStart(3, '0')}:${source.repositoryPath}`;
  };
  const blocks = new Map<string, ReplayBlock>();
  const blockByPath = new Map<string, string>();
  const addBlock = (source: ReplaySource, sources = [source]) => {
    blocks.set(source.repositoryPath, {
      sortKey: sourceSortKey(source),
      sources,
    });
    for (const item of sources)
      blockByPath.set(item.repositoryPath, source.repositoryPath);
  };

  for (const source of sourceByPath.values()) {
    if (omitted.has(source.repositoryPath)) continue;
    if (
      adjacent &&
      source.repositoryPath === adjacent.syntheticCompanion.repositoryOwnerPath
    ) {
      continue;
    }
    if (adjacent) {
      const owner = records.get(adjacent.ownerRecordOrdinal);
      if (!owner) throw new Error('unknown replay record');
      if (source.repositoryPath === owner.repositoryOwnerPath) {
        const companion = sourceByPath.get(
          adjacent.syntheticCompanion.repositoryOwnerPath
        );
        if (!companion) throw new Error('unknown replay companion source');
        addBlock(source, [source, companion]);
        continue;
      }
    }
    addBlock(source);
  }

  const edges = new Map<string, Set<string>>();
  const addEdge = (beforePath: string, afterPath: string): void => {
    const before = blockByPath.get(beforePath);
    const after = blockByPath.get(afterPath);
    if (!before || !after) throw new Error('unknown replay source');
    if (before === after) throw new Error('self-referential replay edge');
    const destinations = edges.get(before) ?? new Set<string>();
    destinations.add(after);
    edges.set(before, destinations);
  };
  const recordPath = (recordOrdinal: number): string => {
    const record = records.get(recordOrdinal);
    if (!record) throw new Error('unknown replay record');
    return record.repositoryOwnerPath;
  };
  const groupPaths = new Map<string, string[]>();
  for (const group of provenance.replayConstraints.jobGroups) {
    const paths =
      'pipelineRecords' in group
        ? [...group.pipelineRecords]
            .sort((left, right) => left.logOrdinal - right.logOrdinal)
            .map(({ repositoryOwnerPath }) => repositoryOwnerPath)
        : [...group.includedRecords]
            .sort((left, right) => left.logOrdinal - right.logOrdinal)
            .map(({ recordOrdinal }) => recordPath(recordOrdinal));
    const key = `${group.deploymentRunId}:${group.databaseJobId}`;
    groupPaths.set(key, paths);
    paths.slice(1).forEach((afterPath, index) => {
      addEdge(paths[index] as string, afterPath);
    });
  }
  for (const relation of provenance.replayConstraints.relations) {
    if (relation.kind === 'record-before-record') {
      addEdge(
        recordPath(relation.beforeRecordOrdinal),
        recordPath(relation.afterRecordOrdinal)
      );
    }
    if (relation.kind === 'job-group-before-job-group') {
      const before = groupPaths.get(
        `${relation.before.deploymentRunId}:${relation.before.databaseJobId}`
      );
      const after = groupPaths.get(
        `${relation.after.deploymentRunId}:${relation.after.databaseJobId}`
      );
      if (!before?.length || !after?.length) {
        throw new Error('unknown replay job group');
      }
      addEdge(before.at(-1) as string, after[0] as string);
    }
  }
  const ordered = stableReplayTopologicalSort(blocks, edges);
  if (
    new Set(ordered.map(({ repositoryPath }) => repositoryPath)).size !==
    ordered.length
  ) {
    throw new Error('duplicate production-effect replay source');
  }
  return [...ordered, ...forwardRepairSources(verified)];
}

export function materializeSupabaseHistoryReplay(
  verified: VerifiedReplayManifest,
  mode: SupabaseHistoryReplayMode
): ReplaySource[] {
  if (mode === 'chronological') {
    return [
      ...historicalChronologicalSources(verified),
      ...forwardRepairSources(verified),
    ];
  }
  if (mode === 'production-effect') return productionEffectSources(verified);
  throw new Error('unsupported replay mode');
}
