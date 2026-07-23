import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { readBoundReplayReceipt } from './read-bound-replay-receipt';
import { forwardRepairDeploymentReceiptSchema } from './schemas/forward-repair-deployment-receipt-schema';
import { linkedMigrationLedgerSchema } from './schemas/linked-migration-ledger-schema';
import { productionEffectProvenanceSchema } from './schemas/production-effect-provenance-schema';
import { productionHistoryEffectsSchema } from './schemas/production-history-effects-schema';
import { supabaseHistoryReplayManifest as manifest } from './supabase-history-replay-manifest';
import type { VerifiedReplayManifest } from './supabase-history-replay-types';

type VerifiedCaptureInputs = Pick<
  VerifiedReplayManifest,
  'forwardRepairDeploymentReceipt' | 'productionEffectProvenance'
>;

async function verifyPostDeployFixtures(
  root: string,
  productionEffectProvenance: VerifiedReplayManifest['productionEffectProvenance']
): Promise<void> {
  const linkedLedger = await readBoundReplayReceipt(
    root,
    manifest.linkedLedgerFixture,
    'Linked-ledger fixture',
    linkedMigrationLedgerSchema
  );
  const productionEffects = await readBoundReplayReceipt(
    root,
    manifest.productionEffectsFixture,
    'Production-effect fixture',
    productionHistoryEffectsSchema
  );
  if (
    linkedLedger.schemaVersion !== manifest.linkedLedgerFixture.schemaVersion ||
    linkedLedger.linkedRowCount !==
      manifest.linkedLedgerFixture.linkedRowCount ||
    linkedLedger.linkedTailVersion !==
      manifest.linkedLedgerFixture.linkedTailVersion ||
    linkedLedger.localFileCount !==
      manifest.linkedLedgerFixture.localFileCount ||
    linkedLedger.localUniqueVersionCount !==
      manifest.linkedLedgerFixture.localUniqueVersionCount
  ) {
    throw new Error('Linked-ledger fixture scalar binding drift');
  }
  if (
    productionEffects.schemaVersion !==
      manifest.productionEffectsFixture.schemaVersion ||
    productionEffects.source.querySha256 !==
      manifest.productionEffectsFixture.querySha256 ||
    productionEffects.ledger.rowCount !==
      manifest.productionEffectsFixture.ledgerRowCount ||
    productionEffects.ledger.tailVersion !==
      manifest.productionEffectsFixture.ledgerTailVersion ||
    productionEffects.effectSha256 !==
      manifest.productionEffectsFixture.effectSha256
  ) {
    throw new Error('Production-effect fixture scalar binding drift');
  }
  const provenanceLedger = productionEffectProvenance.linkedLedger.receipt;
  if (
    productionEffects.ledger.rowCount !== linkedLedger.linkedRowCount ||
    productionEffects.ledger.tailVersion !== linkedLedger.linkedTailVersion ||
    productionEffects.ledger.rowCount !== provenanceLedger.rowCount ||
    productionEffects.ledger.tailVersion !== provenanceLedger.tailVersion
  ) {
    throw new Error('Post-deploy fixture ledger binding drift');
  }
}

function verifyForwardRepairReceipt(
  forwardRepairDeploymentReceipt: VerifiedReplayManifest['forwardRepairDeploymentReceipt'],
  productionEffectProvenance: VerifiedReplayManifest['productionEffectProvenance']
): void {
  if (
    forwardRepairDeploymentReceipt.schemaVersion !==
      manifest.forwardRepairReceipt.schemaVersion ||
    forwardRepairDeploymentReceipt.repairs.length !==
      manifest.forwardRepairs.length
  ) {
    throw new Error('Forward-repair deployment receipt scalar binding drift');
  }
  for (const [index, repair] of manifest.forwardRepairs.entries()) {
    const deployed = forwardRepairDeploymentReceipt.repairs[index];
    if (
      !deployed ||
      deployed.manifestOrdinal !== index + 1 ||
      deployed.path !== repair.path ||
      deployed.sha256 !== repair.sha256 ||
      deployed.changedComponent.category !== repair.changedComponent.category ||
      deployed.changedComponent.identity !== repair.changedComponent.identity
    ) {
      throw new Error('Forward-repair deployment receipt manifest drift');
    }
  }
  const historicalPaths = new Set(
    productionEffectProvenance.exceptionalRecords.map(
      ({ repositoryOwnerPath }) => repositoryOwnerPath
    )
  );
  if (
    forwardRepairDeploymentReceipt.repairs.some(({ path: repairPath }) =>
      historicalPaths.has(repairPath)
    )
  ) {
    throw new Error('Forward repair leaked into historical provenance');
  }
  const deployment = forwardRepairDeploymentReceipt.deployment;
  const finalGroup =
    productionEffectProvenance.replayConstraints.jobGroups.at(-1);
  if (
    finalGroup?.coverage !== 'complete-deployment-repair-log-group' ||
    finalGroup.deploymentRunId !== deployment.runId ||
    finalGroup.databaseJobId !== deployment.databaseJobId ||
    finalGroup.observedMigrationEntryCount !==
      deployment.observedMigrationEntryCount ||
    finalGroup.forwardRepairReceiptLogOrdinals.length !==
      forwardRepairDeploymentReceipt.repairs.length ||
    finalGroup.forwardRepairReceiptLogOrdinals.some(
      (ordinal, index) =>
        ordinal !== forwardRepairDeploymentReceipt.repairs[index]?.logOrdinal
    )
  ) {
    throw new Error('Forward-repair deployment job binding drift');
  }
  const deploymentEvidence = productionEffectProvenance.evidenceSources.find(
    (source) =>
      source.deploymentRunId === deployment.runId &&
      source.databaseJobId === deployment.databaseJobId
  );
  if (
    !deploymentEvidence ||
    deploymentEvidence.headSha !== deployment.headSha ||
    deploymentEvidence.jobConclusion !== deployment.jobConclusion ||
    deploymentEvidence.sanitizedJobLogSha256 !==
      deployment.sanitizedJobLogSha256
  ) {
    throw new Error('Forward-repair deployment evidence binding drift');
  }
}

export async function verifyProductionEffectCaptureInputs(
  workspaceRoot: string
): Promise<VerifiedCaptureInputs> {
  const root = await realpath(path.resolve(workspaceRoot));
  const productionEffectProvenance = await readBoundReplayReceipt(
    root,
    manifest.provenance,
    'Production-effect provenance',
    productionEffectProvenanceSchema
  );
  await verifyPostDeployFixtures(root, productionEffectProvenance);
  const forwardRepairDeploymentReceipt = await readBoundReplayReceipt(
    root,
    manifest.forwardRepairReceipt,
    'Forward-repair deployment receipt',
    forwardRepairDeploymentReceiptSchema
  );
  verifyForwardRepairReceipt(
    forwardRepairDeploymentReceipt,
    productionEffectProvenance
  );
  return { forwardRepairDeploymentReceipt, productionEffectProvenance };
}
