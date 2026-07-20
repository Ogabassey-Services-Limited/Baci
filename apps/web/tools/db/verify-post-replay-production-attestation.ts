import { createHash } from 'node:crypto';
import path from 'node:path';
import { canonicalReplayEffectJson } from './canonical-replay-effect-json';
import { postReplayProductionAttestationReceipt as receipt } from './post-replay-production-attestation-receipt';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';

type LedgerRow = { name: string; version: string };
type Digest = { category: string; identity: string; sha256: string };
type EffectAttestation = {
  baseSha: string;
  digestVector: Digest[];
  effectSha256: string;
  effects: Record<string, boolean | number> & {
    componentCount: number;
    domainEventRpcCount: number;
  };
  ledger: { rowCount: number; tailVersion: string };
  schemaVersion: number;
  scope: {
    componentCount: number;
    manifestSha256: string;
    version: string;
  };
  source: {
    kind: string;
    querySha256: string;
    serverVersionNum: number;
  };
};
type LedgerAttestation = {
  inventorySha256: string;
  rowCount: number;
  rows: LedgerRow[];
  tailVersion: string;
};
type ChangedComponent = {
  category: string;
  frozenSha256: string;
  identity: string;
  liveSha256: string;
};
type AttestationInput = {
  comparison: { changedComponents: ChangedComponent[] };
  deployment: {
    appliedEntries: LedgerRow[];
    databaseJob: { conclusion: string; id: number };
    mergeSha: string;
    run: { conclusion: string; headSha: string; id: number };
    semanticLogSha256: string;
    summary: { applied: number; skipped: number };
  };
  frozenEffect: EffectAttestation;
  frozenLedger: LedgerAttestation;
  liveEffect: EffectAttestation;
  liveLedger: LedgerAttestation;
};

const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const expectedEffects = {
  componentCount: receipt.effects.componentCount,
  customerCancellationSurfacePresent: true,
  domainEventRpcCount: receipt.effects.domainEventRpcCount,
  eventPolicyRolesExact: true,
  everyDomainEventProducerDisabled: true,
  fulfillmentTimestampsReady: true,
  merchantAnonProjectionExact: true,
  merchantFeatureSettingsReadWithheld: true,
  pgmqDomainEventsQueuePresent: true,
  pgmqProtectedRolesWithheld: true,
  pgmqPublicSchemaAbsent: true,
  requiredExtensionsPresent: true,
};

function ledgerSha256(rows: readonly LedgerRow[]): string {
  return sha256(
    rows.map(({ name, version }) => `${version}\t${name}\n`).join('')
  );
}

function assertLedgerRows(rows: readonly LedgerRow[]): void {
  for (const [index, row] of rows.entries()) {
    if (
      !/^\d{14}$/.test(row.version) ||
      !/^[a-z0-9_]+$/.test(row.name) ||
      (index > 0 && (rows[index - 1]?.version ?? '') >= row.version)
    ) {
      throw new Error('Live ledger receipt is invalid');
    }
  }
}

function manifestSuffix(): LedgerRow[] {
  return supabaseHistoryReplayManifest.postReplaySources.map(
    ({ repositoryPath }) => {
      const match = path.posix
        .basename(repositoryPath)
        .match(/^(\d{14})_([a-z0-9_]+)[.]sql$/);
      if (!match) throw new Error('Post-replay manifest source is invalid');
      return { name: match[2] as string, version: match[1] as string };
    }
  );
}

function assertLedger(input: AttestationInput): void {
  const frozen = receipt.ledger.frozenPrefix;
  if (
    input.frozenLedger.rowCount !== frozen.rowCount ||
    input.frozenLedger.rows.length !== frozen.rowCount ||
    input.frozenLedger.tailVersion !== frozen.tailVersion ||
    input.frozenLedger.rows.at(-1)?.version !== frozen.tailVersion ||
    input.frozenLedger.inventorySha256 !== frozen.inventorySha256 ||
    ledgerSha256(input.frozenLedger.rows) !== frozen.inventorySha256
  ) {
    throw new Error('Frozen ledger receipt mismatch');
  }

  const prefix = input.liveLedger.rows.slice(0, frozen.rowCount);
  if (!same(prefix, input.frozenLedger.rows)) {
    throw new Error('Frozen ledger prefix mismatch');
  }
  const suffix = input.liveLedger.rows.slice(frozen.rowCount);
  const expectedSuffix = manifestSuffix();
  if (
    expectedSuffix.length !== receipt.ledger.postReplaySourceCount ||
    !same(suffix, expectedSuffix)
  ) {
    throw new Error('Post-replay suffix mismatch');
  }

  assertLedgerRows(input.liveLedger.rows);
  const live = receipt.ledger.live;
  if (
    input.liveLedger.rowCount !== live.rowCount ||
    input.liveLedger.rows.length !== live.rowCount ||
    input.liveLedger.tailVersion !== live.tailVersion ||
    input.liveLedger.rows.at(-1)?.version !== live.tailVersion ||
    input.liveLedger.inventorySha256 !== live.inventorySha256 ||
    ledgerSha256(input.liveLedger.rows) !== live.inventorySha256
  ) {
    throw new Error('Live ledger receipt mismatch');
  }
}

function assertEffectSafety(
  effect: EffectAttestation,
  expectedLedger: { rowCount: number; tailVersion: string }
): void {
  const expected = receipt.effects;
  if (
    effect.source.kind !== expected.sourceKind ||
    effect.source.querySha256 !== expected.querySha256
  ) {
    throw new Error('Effect query safety mismatch');
  }
  if (
    effect.scope.version !== expected.scopeVersion ||
    effect.scope.manifestSha256 !== expected.scopeManifestSha256 ||
    effect.scope.componentCount !== expected.componentCount
  ) {
    throw new Error('Effect scope safety mismatch');
  }
  if (effect.source.serverVersionNum !== expected.serverVersionNum) {
    throw new Error('Effect server safety mismatch');
  }
  if (effect.effects.domainEventRpcCount !== expected.domainEventRpcCount) {
    throw new Error('Effect RPC safety mismatch');
  }
  if (
    effect.schemaVersion !== 2 ||
    effect.baseSha !== expected.baseSha ||
    effect.digestVector.length !== expected.componentCount ||
    !same(effect.effects, expectedEffects)
  ) {
    throw new Error('Effect component safety mismatch');
  }
  if (!same(effect.ledger, expectedLedger)) {
    throw new Error('Effect ledger receipt mismatch');
  }
}

function actualChanges(
  frozen: readonly Digest[],
  live: readonly Digest[]
): ChangedComponent[] {
  const frozenMap = new Map(
    frozen.map((value) => [`${value.category}\0${value.identity}`, value])
  );
  const liveMap = new Map(
    live.map((value) => [`${value.category}\0${value.identity}`, value])
  );
  return [...new Set([...frozenMap.keys(), ...liveMap.keys()])]
    .sort()
    .flatMap((key) => {
      const before = frozenMap.get(key);
      const after = liveMap.get(key);
      if (before?.sha256 === after?.sha256 || !before || !after) return [];
      return [
        {
          category: after.category,
          frozenSha256: before.sha256,
          identity: after.identity,
          liveSha256: after.sha256,
        },
      ];
    });
}

function assertEffects(input: AttestationInput): void {
  const expected = receipt.effects;
  assertEffectSafety(input.frozenEffect, {
    rowCount: receipt.ledger.frozenPrefix.rowCount,
    tailVersion: receipt.ledger.frozenPrefix.tailVersion,
  });
  assertEffectSafety(input.liveEffect, {
    rowCount: receipt.ledger.live.rowCount,
    tailVersion: receipt.ledger.live.tailVersion,
  });
  if (!same(input.comparison.changedComponents, expected.changedComponents)) {
    throw new Error('Changed component receipt mismatch');
  }
  const differences = actualChanges(
    input.frozenEffect.digestVector,
    input.liveEffect.digestVector
  );
  if (!same(differences, expected.changedComponents)) {
    throw new Error('Changed component digest mismatch');
  }
  const frozenSha = sha256(
    canonicalReplayEffectJson(input.frozenEffect.digestVector)
  );
  const liveSha = sha256(
    canonicalReplayEffectJson(input.liveEffect.digestVector)
  );
  if (
    input.frozenEffect.effectSha256 !== expected.frozenEffectSha256 ||
    frozenSha !== expected.frozenEffectSha256 ||
    input.liveEffect.effectSha256 !== expected.liveEffectSha256 ||
    liveSha !== expected.liveEffectSha256
  ) {
    throw new Error('Effect receipt mismatch');
  }
}

function assertDeployment(input: AttestationInput): void {
  const expected = receipt.deployment;
  if (!same(input.deployment.appliedEntries, expected.appliedEntries)) {
    throw new Error('Deployment applied entries mismatch');
  }
  if (
    input.deployment.mergeSha !== expected.mergeSha ||
    input.deployment.run.id !== expected.run.id ||
    input.deployment.run.headSha !== expected.run.headSha ||
    input.deployment.run.conclusion !== expected.run.conclusion ||
    input.deployment.databaseJob.id !== expected.databaseJob.id ||
    input.deployment.databaseJob.conclusion !== expected.databaseJob.conclusion
  ) {
    throw new Error('Deployment metadata mismatch');
  }
  if (
    input.deployment.semanticLogSha256 !== expected.semanticLogSha256 ||
    !same(input.deployment.summary, expected.summary)
  ) {
    throw new Error('Deployment receipt mismatch');
  }
}

export function verifyPostReplayProductionAttestation(input: AttestationInput) {
  assertLedger(input);
  assertEffects(input);
  assertDeployment(input);
  return receipt;
}
