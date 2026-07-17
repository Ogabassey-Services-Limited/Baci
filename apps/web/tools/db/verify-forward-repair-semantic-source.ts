import type { ForwardRepairDeploymentReceipt } from './schemas/forward-repair-deployment-receipt-schema';
import { supabaseHistoryReplayManifest as manifest } from './supabase-history-replay-manifest';

type SemanticSource = {
  databaseJobId: number;
  deploymentRunId: number;
  parsed: {
    appliedEntries: Array<{
      logOrdinal: number;
      name: string;
      version: string;
    }>;
    summary: { applied: number; skipped: number } | null;
  };
  sanitizedJobLogSha256: string;
};

export function verifyForwardRepairSemanticSource(
  receipt: ForwardRepairDeploymentReceipt,
  source: SemanticSource
): void {
  const manifestRepair = manifest.productionMappings.find(
    (mapping) => mapping.repositoryPath === manifest.repair.path
  );
  const expectedEntries = [
    ...(manifestRepair
      ? [
          {
            logOrdinal: 1,
            name: manifestRepair.appliedName,
            version: manifestRepair.appliedVersion,
          },
        ]
      : []),
    ...receipt.repairs.map(({ logOrdinal, migration }) => ({
      logOrdinal,
      ...migration,
    })),
  ];
  const mismatch =
    !manifestRepair ||
    source.deploymentRunId !== receipt.deployment.runId ||
    source.databaseJobId !== receipt.deployment.databaseJobId ||
    source.sanitizedJobLogSha256 !== receipt.deployment.sanitizedJobLogSha256 ||
    source.parsed.appliedEntries.length !==
      receipt.deployment.observedMigrationEntryCount ||
    expectedEntries.length !== receipt.deployment.observedMigrationEntryCount ||
    source.parsed.summary?.applied !== receipt.deployment.summary.applied ||
    source.parsed.summary.skipped !== receipt.deployment.summary.skipped ||
    expectedEntries.some((expected) => {
      const applied = source.parsed.appliedEntries[expected.logOrdinal - 1];
      return (
        applied?.logOrdinal !== expected.logOrdinal ||
        applied.version !== expected.version ||
        applied.name !== expected.name
      );
    });
  if (mismatch) {
    throw new Error('Forward-repair semantic source mismatch');
  }
}
