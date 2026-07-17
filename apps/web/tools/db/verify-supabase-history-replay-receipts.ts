import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { buildVerifiedReplaySourceHashes } from './build-verified-replay-source-hashes';
import { parseGithubMigrationJobLog } from './parse-github-migration-job-log';
import { readBoundReplayReceipt } from './read-bound-replay-receipt';
import { githubMigrationSemanticLinesSchemaForSources } from './schemas/github-migration-semantic-lines-schema';
import { migrationNameAliasDeployRepairSchema } from './schemas/migration-name-alias-deploy-repair-schema';
import { supabaseHistoryReplayManifest as manifest } from './supabase-history-replay-manifest';
import type { VerifiedReplayManifest } from './supabase-history-replay-types';
import { verifyForwardRepairSemanticSource } from './verify-forward-repair-semantic-source';
import { verifyProductionEffectCaptureInputs } from './verify-production-effect-capture-inputs';

type VerifiedReceipts = Pick<
  VerifiedReplayManifest,
  | 'forwardRepairDeploymentReceipt'
  | 'migrationNameAliasDeployRepair'
  | 'productionEffectProvenance'
> & { expectedSourceHashes: ReadonlyMap<string, string> };

export async function verifySupabaseHistoryReplayReceipts(
  workspaceRoot: string
): Promise<VerifiedReceipts> {
  const root = await realpath(path.resolve(workspaceRoot));
  const { forwardRepairDeploymentReceipt, productionEffectProvenance } =
    await verifyProductionEffectCaptureInputs(root);
  const semanticBindings = productionEffectProvenance.evidenceSources.flatMap(
    (source) => [
      {
        databaseJobId: source.databaseJobId,
        deploymentRunId: source.deploymentRunId,
        kind: 'primary' as const,
        sanitizedJobLogSha256: source.sanitizedJobLogSha256,
      },
      ...(source.corroboration
        ? [
            {
              databaseJobId: source.corroboration.databaseJobId,
              deploymentRunId: source.corroboration.deploymentRunId,
              kind: 'corroboration' as const,
              sanitizedJobLogSha256: source.corroboration.sanitizedJobLogSha256,
            },
          ]
        : []),
    ]
  );
  const semanticFixture = await readBoundReplayReceipt(
    root,
    manifest.semanticFixture,
    'GitHub migration semantic fixture',
    githubMigrationSemanticLinesSchemaForSources(semanticBindings)
  );
  if (semanticFixture.sources.length !== manifest.semanticFixture.sourceCount) {
    throw new Error('GitHub migration semantic fixture source-count drift');
  }
  const repairSource = semanticFixture.sources.find(
    (source) =>
      source.deploymentRunId ===
        forwardRepairDeploymentReceipt.deployment.runId &&
      source.databaseJobId ===
        forwardRepairDeploymentReceipt.deployment.databaseJobId
  );
  if (!repairSource) {
    throw new Error('Forward-repair semantic source is missing');
  }
  verifyForwardRepairSemanticSource(forwardRepairDeploymentReceipt, {
    databaseJobId: repairSource.databaseJobId,
    deploymentRunId: repairSource.deploymentRunId,
    parsed: parseGithubMigrationJobLog(repairSource.lines),
    sanitizedJobLogSha256: repairSource.sanitizedJobLogSha256,
  });
  const migrationNameAliasDeployRepair = await readBoundReplayReceipt(
    root,
    manifest.aliasReceipt,
    'Migration-name alias receipt',
    migrationNameAliasDeployRepairSchema
  );
  if (migrationNameAliasDeployRepair.baseSha !== manifest.baseSha) {
    throw new Error(
      'Migration-name alias receipt baseSha does not match the frozen manifest'
    );
  }
  if (
    productionEffectProvenance.exceptionalRecords.some(
      (record) =>
        record.applied?.version === migrationNameAliasDeployRepair.alias.version
    )
  ) {
    throw new Error(
      'Migration-name alias version leaked into production-effect provenance'
    );
  }
  return {
    expectedSourceHashes: buildVerifiedReplaySourceHashes(
      productionEffectProvenance
    ),
    forwardRepairDeploymentReceipt,
    migrationNameAliasDeployRepair,
    productionEffectProvenance,
  };
}
