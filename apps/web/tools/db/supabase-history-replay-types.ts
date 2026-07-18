import type { ForwardRepairDeploymentReceipt } from './schemas/forward-repair-deployment-receipt-schema';
import type { MigrationNameAliasDeployRepair } from './schemas/migration-name-alias-deploy-repair-schema';
import type { ProductionEffectProvenance } from './schemas/production-effect-provenance-schema';

export type SupabaseHistoryReplayMode = 'chronological' | 'production-effect';

export type SupabaseHistoryEffectComparisonMode = 'classify' | 'enforce';

export type ProductionOldCancellationProofMode = 'required' | 'skip';

export type ProductionOldCancellationProofReceipt = {
  productionSha256: string;
  repairedSha256: string;
  verified: true;
};

export type SupabaseHistoryEffectComparisonReceipt = {
  changedComponents: Array<{
    category: string;
    identity: string;
    localSha256: string | null;
    productionSha256: string | null;
  }>;
  converged: boolean;
  mode: SupabaseHistoryEffectComparisonMode;
  productionEffectSha256: string;
};

export type ReplayCommand = (
  command: string,
  args: readonly string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string }
) => Promise<{ stderr: string; stdout: string }>;

export type ReplaySource = {
  receiptId: string;
  repositoryPath: string;
  sha256: string;
  transform?: {
    originalSha256: string;
    outputSha256: string;
    replacement: string;
    search: string;
  };
};

export type ReplayReceipt = {
  baseSha: string;
  comparison: SupabaseHistoryEffectComparisonReceipt;
  effectSha256: string;
  mode: SupabaseHistoryReplayMode;
  orderedSources: readonly ReplaySource[];
  productionOldCancellationProof?: ProductionOldCancellationProofReceipt;
  serverVersionNum: 170006;
  sqlChecks: readonly string[];
};

export type FrozenReplaySource = {
  repositoryPath: string;
  sha256: string;
};

export type ProductionReplayMapping = FrozenReplaySource & {
  appliedName: string;
  appliedVersion: string;
  linkedName: string;
  productionVersion: string;
  rule: 'append-only-repair' | 'canonical' | 'superseded-final-state';
};

export type ForwardReplayRepair = {
  changedComponent: {
    category: 'function';
    identity: string;
  };
  path: string;
  reason: string;
  sha256: string;
};

export type ReplayTransform = {
  originalSha256: string;
  outputSha256: string;
  overlayPath: string;
  replacement: string;
  repositoryPath: string;
  search: string;
};

export type SupabaseHistoryReplayManifest = {
  aliasReceipt: { path: string; sha256: string };
  baseRegistry: {
    fileCount: number;
    tailVersion: string;
    uniqueVersionCount: number;
  };
  baseSha: string;
  bootstrap: {
    count: number;
    receiptSha256: string;
    tailPath: string;
    tailSha256: string;
  };
  duplicateGroups: readonly {
    sources: readonly (readonly [repositoryPath: string, sha256: string])[];
    uniqueReapply?: readonly [repositoryPath: string, sha256: string];
    version: string;
  }[];
  forwardRepairs: readonly ForwardReplayRepair[];
  forwardRepairReceipt: {
    path: string;
    schemaVersion: number;
    sha256: string;
  };
  linkedLedgerFixture: {
    linkedRowCount: number;
    linkedTailVersion: string;
    localFileCount: number;
    localUniqueVersionCount: number;
    path: string;
    schemaVersion: number;
    sha256: string;
  };
  pipelineSources: readonly FrozenReplaySource[];
  postReplaySources: readonly FrozenReplaySource[];
  productionMappings: readonly ProductionReplayMapping[];
  productionEffectsFixture: {
    effectSha256: string;
    ledgerRowCount: number;
    ledgerTailVersion: string;
    path: string;
    querySha256: string;
    schemaVersion: number;
    sha256: string;
  };
  provenance: {
    evidenceSourceCount: number;
    exceptionalRecordCount: number;
    path: string;
    relationCount: number;
    schemaVersion: number;
    sha256: string;
  };
  repair: { body: string; path: string; sha256: string };
  semanticFixture: { path: string; sha256: string; sourceCount: number };
  transforms: readonly ReplayTransform[];
};

export type PendingRepairState = 'materialized' | 'not-materialized';

export type VerifiedReplayManifest = {
  bootstrapSources: readonly ReplaySource[];
  manifest: SupabaseHistoryReplayManifest;
  migrationNameAliasDeployRepair: MigrationNameAliasDeployRepair;
  forwardRepairDeploymentReceipt: ForwardRepairDeploymentReceipt;
  pendingRepairState: PendingRepairState;
  postReplaySources: readonly ReplaySource[];
  productionEffectProvenance: ProductionEffectProvenance;
  verifiedSources: readonly ReplaySource[];
};
