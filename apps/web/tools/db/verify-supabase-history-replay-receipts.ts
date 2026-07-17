import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { buildVerifiedReplaySourceHashes } from './build-verified-replay-source-hashes';
import { readBoundReplayReceipt } from './read-bound-replay-receipt';
import { migrationNameAliasDeployRepairSchema } from './schemas/migration-name-alias-deploy-repair-schema';
import { productionEffectProvenanceSchema } from './schemas/production-effect-provenance-schema';
import { supabaseHistoryReplayManifest as manifest } from './supabase-history-replay-manifest';
import type { VerifiedReplayManifest } from './supabase-history-replay-types';

type VerifiedReceipts = Pick<
  VerifiedReplayManifest,
  'migrationNameAliasDeployRepair' | 'productionEffectProvenance'
> & { expectedSourceHashes: ReadonlyMap<string, string> };

export async function verifySupabaseHistoryReplayReceipts(
  workspaceRoot: string
): Promise<VerifiedReceipts> {
  const root = await realpath(path.resolve(workspaceRoot));
  const productionEffectProvenance = await readBoundReplayReceipt(
    root,
    manifest.provenance,
    'Production-effect provenance',
    productionEffectProvenanceSchema
  );
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
    migrationNameAliasDeployRepair,
    productionEffectProvenance,
  };
}
