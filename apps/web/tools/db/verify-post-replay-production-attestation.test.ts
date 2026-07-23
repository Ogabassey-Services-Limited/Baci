import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalReplayEffectJson } from './canonical-replay-effect-json';
import { postReplayProductionAttestationReceipt } from './post-replay-production-attestation-receipt';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';
import { verifyPostReplayProductionAttestation } from './verify-post-replay-production-attestation';

type LedgerRow = { name: string; version: string };
type Digest = { category: string; identity: string; sha256: string };
type AttestationInput = Parameters<
  typeof verifyPostReplayProductionAttestation
>[0];
type EffectAttestation = AttestationInput['frozenEffect'];
type InputMutation = (input: AttestationInput) => void;
const EXPECTED_COMPONENT = {
  category: 'constraint',
  frozenSha256:
    'e8c7feafd3d4249f19bdabadb9d38075dc303ec4b0c5e0dad579698500fb7906',
  identity:
    'public.reconciliation_review.reconciliation_review_issue_type_check',
  liveSha256:
    'b8162359116ec9a8565e08b8050a9646f711d081878f21c56a05f9963ff0c229',
} as const;
const fixture = <T>(filename: string): T =>
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'fixtures', filename), 'utf8')
  ) as T;
function ledgerSha256(rows: readonly LedgerRow[]): string {
  return createHash('sha256')
    .update(rows.map(({ name, version }) => `${version}\t${name}\n`).join(''))
    .digest('hex');
}
function effectSha256(digests: readonly Digest[]): string {
  return createHash('sha256')
    .update(canonicalReplayEffectJson(digests))
    .digest('hex');
}
function postReplayRows(): LedgerRow[] {
  return supabaseHistoryReplayManifest.postReplaySources.map(
    ({ repositoryPath }) => {
      const match = path.posix
        .basename(repositoryPath)
        .match(/^(\d{14})_([a-z0-9_]+)[.]sql$/);
      if (!match) throw new Error('invalid test manifest source');
      return { name: match[2] as string, version: match[1] as string };
    }
  );
}
function inputFixture(): AttestationInput {
  const frozenLedgerFixture = fixture<{ rows: LedgerRow[] }>(
    'linked-migration-ledger.json'
  );
  const frozenRows = frozenLedgerFixture.rows.map(({ name, version }) => ({
    name,
    version,
  }));
  const liveRows = [...structuredClone(frozenRows), ...postReplayRows()];
  const frozenEffect = fixture<EffectAttestation>(
    'production-history-effects.json'
  );
  const liveEffect = structuredClone(frozenEffect);
  const changed = liveEffect.digestVector.find(
    ({ category, identity }) =>
      category === EXPECTED_COMPONENT.category &&
      identity === EXPECTED_COMPONENT.identity
  );
  if (!changed) throw new Error('missing changed component fixture');
  changed.sha256 = EXPECTED_COMPONENT.liveSha256;
  liveEffect.effectSha256 = effectSha256(liveEffect.digestVector);
  liveEffect.ledger = {
    rowCount: liveRows.length,
    tailVersion: liveRows.at(-1)?.version ?? '',
  };
  return {
    comparison: { changedComponents: [{ ...EXPECTED_COMPONENT }] },
    deployment: {
      appliedEntries: postReplayRows(),
      databaseJob: { conclusion: 'success', id: 88164086530 },
      mergeSha: 'fb6c7570ac1a0897efb9890db6b9992410c5eb7a',
      run: {
        conclusion: 'success',
        headSha: 'fb6c7570ac1a0897efb9890db6b9992410c5eb7a',
        id: 29676236659,
      },
      semanticLogSha256:
        '9c91aeab90841c40970f18a4d37a988f85a9204a6fde36daa4a07bdea5438ffa',
      summary: { applied: 12, skipped: 427 },
    },
    frozenEffect,
    frozenLedger: {
      inventorySha256: ledgerSha256(frozenRows),
      rowCount: frozenRows.length,
      rows: frozenRows,
      tailVersion: frozenRows.at(-1)?.version ?? '',
    },
    liveEffect,
    liveLedger: {
      inventorySha256: ledgerSha256(liveRows),
      rowCount: liveRows.length,
      rows: liveRows,
      tailVersion: liveRows.at(-1)?.version ?? '',
    },
  };
}
function expectRejected(mutate: InputMutation, message: RegExp): void {
  const input = inputFixture();
  mutate(input);
  expect(() => verifyPostReplayProductionAttestation(input)).toThrow(message);
}
describe('verifyPostReplayProductionAttestation', () => {
  it('returns the bounded receipt without mutating captured evidence', () => {
    const input = inputFixture();
    const before = structuredClone(input);
    expect(verifyPostReplayProductionAttestation(input)).toEqual(
      postReplayProductionAttestationReceipt
    );
    expect(input).toEqual(before);
  });
  it.each<[string, InputMutation]>([
    ['row count', (input) => (input.frozenLedger.rowCount -= 1)],
    ['tail', (input) => (input.frozenLedger.tailVersion = '20260714225502')],
    ['SHA', (input) => (input.frozenLedger.inventorySha256 = '0'.repeat(64))],
  ])('rejects frozen ledger %s drift', (_label, mutate) => {
    expectRejected(mutate, /frozen ledger receipt/i);
  });
  it('rejects live prefix drift from the preserved frozen ledger', () => {
    const input = inputFixture();
    input.liveLedger.rows[0] = {
      ...input.liveLedger.rows[0],
      name: 'drifted_frozen_prefix',
    } as LedgerRow;
    expect(() => verifyPostReplayProductionAttestation(input)).toThrow(
      /frozen ledger prefix/i
    );
  });
  it('rejects suffix rows not exactly derived from manifest postReplaySources', () => {
    const input = inputFixture();
    input.liveLedger.rows[442] = {
      ...input.liveLedger.rows[442],
      name: 'not_the_manifest_source',
    } as LedgerRow;
    expect(() => verifyPostReplayProductionAttestation(input)).toThrow(
      /post-replay suffix/i
    );
  });
  it.each<[string, InputMutation]>([
    ['row count', (input) => (input.liveLedger.rowCount -= 1)],
    ['tail', (input) => (input.liveLedger.tailVersion = '20260718070010')],
    ['SHA', (input) => (input.liveLedger.inventorySha256 = '0'.repeat(64))],
  ])('rejects full live ledger %s drift', (_label, mutate) => {
    expectRejected(mutate, /live ledger receipt/i);
  });
  it.each<[string, InputMutation]>([
    ['frozen', (input) => (input.frozenEffect.effectSha256 = '0'.repeat(64))],
    ['live', (input) => (input.liveEffect.effectSha256 = '0'.repeat(64))],
  ])('rejects %s effect hash drift', (_label, mutate) => {
    expectRejected(mutate, /effect receipt/i);
  });
  it.each<[string, InputMutation]>([
    [
      'cardinality',
      (input) =>
        input.comparison.changedComponents.push({ ...EXPECTED_COMPONENT }),
    ],
    [
      'category',
      (input) => (input.comparison.changedComponents[0].category = 'function'),
    ],
    [
      'identity',
      (input) =>
        (input.comparison.changedComponents[0].identity = 'public.wrong'),
    ],
    [
      'frozen hash',
      (input) =>
        (input.comparison.changedComponents[0].frozenSha256 = '0'.repeat(64)),
    ],
    [
      'live hash',
      (input) =>
        (input.comparison.changedComponents[0].liveSha256 = '0'.repeat(64)),
    ],
  ])('rejects changed-component %s drift', (_label, mutate) => {
    expectRejected(mutate, /changed component/i);
  });
  it.each([
    'frozenEffect',
    'liveEffect',
  ] as const)('rejects unsafe query binding on %s', (target) => {
    const input = inputFixture();
    input[target].source.querySha256 = '0'.repeat(64);
    expect(() => verifyPostReplayProductionAttestation(input)).toThrow(
      /query safety/i
    );
  });
  it.each([
    'version',
    'manifestSha256',
    'componentCount',
  ] as const)('rejects scope %s drift', (field) => {
    const input = inputFixture();
    if (field === 'componentCount') input.liveEffect.scope[field] = 75;
    else input.liveEffect.scope[field] = 'drift';
    expect(() => verifyPostReplayProductionAttestation(input)).toThrow(
      /scope safety/i
    );
  });
  it('rejects server-version drift', () => {
    const input = inputFixture();
    input.liveEffect.source.serverVersionNum = 170007;
    expect(() => verifyPostReplayProductionAttestation(input)).toThrow(
      /server safety/i
    );
  });
  it.each<[string, InputMutation]>([
    [
      'declared count',
      (input) => (input.liveEffect.effects.componentCount = 75),
    ],
    ['identity scope', (input) => input.liveEffect.digestVector.pop()],
    [
      'unsafe flag',
      (input) => (input.liveEffect.effects.requiredExtensionsPresent = false),
    ],
  ])('rejects component %s drift', (_label, mutate) => {
    expectRejected(mutate, /component safety/i);
  });
  it.each<[string, InputMutation]>([
    [
      'missing required flag',
      (input) => {
        Reflect.deleteProperty(
          input.liveEffect.effects,
          'requiredExtensionsPresent'
        );
      },
    ],
    [
      'additional true flag',
      (input) => {
        Object.assign(input.liveEffect.effects, { unexpectedSafetyFlag: true });
      },
    ],
  ])('rejects an exact safety summary with %s', (_label, mutate) => {
    expectRejected(mutate, /component safety/i);
  });
  it('rejects public RPC count drift', () => {
    expectRejected(
      (input) => (input.liveEffect.effects.domainEventRpcCount = 18),
      /RPC safety/i
    );
  });
  it.each<[string, InputMutation]>([
    ['merge', (input) => (input.deployment.mergeSha = '0'.repeat(40))],
    ['run head', (input) => (input.deployment.run.headSha = '0'.repeat(40))],
    ['run id', (input) => (input.deployment.run.id = 1)],
    ['run result', (input) => (input.deployment.run.conclusion = 'failure')],
    ['job id', (input) => (input.deployment.databaseJob.id = 1)],
    [
      'job result',
      (input) => (input.deployment.databaseJob.conclusion = 'failure'),
    ],
  ])('rejects deployment %s metadata drift', (_label, mutate) => {
    expectRejected(mutate, /deployment metadata/i);
  });
  it.each<[string, InputMutation]>([
    [
      'semantic log',
      (input) => (input.deployment.semanticLogSha256 = '0'.repeat(64)),
    ],
    ['applied summary', (input) => (input.deployment.summary.applied = 11)],
    ['skipped summary', (input) => (input.deployment.summary.skipped = 428)],
  ])('rejects deployment %s drift', (_label, mutate) => {
    expectRejected(mutate, /deployment receipt/i);
  });
  it.each<[string, InputMutation]>([
    ['missing entry', (input) => input.deployment.appliedEntries.pop()],
    ['reordered entries', (input) => input.deployment.appliedEntries.reverse()],
    [
      'duplicate entry',
      (input) =>
        input.deployment.appliedEntries.push({
          ...input.deployment.appliedEntries[0],
        }),
    ],
    [
      'additional entry',
      (input) =>
        input.deployment.appliedEntries.push({
          name: 'extra',
          version: '20260718070012',
        }),
    ],
  ])('rejects deployment %s', (_label, mutate) => {
    expectRejected(mutate, /deployment applied entries/i);
  });
});
