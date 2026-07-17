import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { materializeSupabaseHistoryReplay } from './materialize-supabase-history-replay';
import type { VerifiedReplayManifest } from './supabase-history-replay-types';
import { verifySupabaseHistoryReplayManifest } from './verify-supabase-history-replay-manifest';

const workspaceRoot = path.resolve(import.meta.dirname, '../../../..');
let verified: VerifiedReplayManifest;

function cloneVerified(): VerifiedReplayManifest {
  return structuredClone(verified);
}

function immediateCompanionRelation(value: VerifiedReplayManifest) {
  const relation =
    value.productionEffectProvenance.replayConstraints.relations.find(
      (candidate) =>
        candidate.kind === 'duplicate-version-companion' &&
        candidate.replayDisposition ===
          'apply-synthetic-companion-immediately-after-owner'
    );
  if (!relation) throw new Error('missing immediate companion test fixture');
  return relation;
}

beforeAll(async () => {
  verified = await verifySupabaseHistoryReplayManifest(workspaceRoot, {
    pendingRepairState: 'materialized',
  });
}, 60_000);

describe('materializeSupabaseHistoryReplay relation validation', () => {
  it('rejects unknown relation records', () => {
    const invalid = cloneVerified();
    invalid.productionEffectProvenance.replayConstraints.relations.push({
      afterRecordOrdinal: 1,
      beforeRecordOrdinal: 999,
      kind: 'record-before-record',
      reason: 'invalid_test_relation',
    });

    expect(() =>
      materializeSupabaseHistoryReplay(invalid, 'production-effect')
    ).toThrow('unknown replay record');
  });

  it('rejects a record relation that points to itself', () => {
    const invalid = cloneVerified();
    invalid.productionEffectProvenance.replayConstraints.relations.push({
      afterRecordOrdinal: 1,
      beforeRecordOrdinal: 1,
      kind: 'record-before-record',
      reason: 'invalid_self_relation',
    });

    expect(() =>
      materializeSupabaseHistoryReplay(invalid, 'production-effect')
    ).toThrow('self-referential replay edge');
  });

  it('rejects a job-group relation that points to itself', () => {
    const invalid = cloneVerified();
    const group =
      invalid.productionEffectProvenance.replayConstraints.jobGroups.find(
        ({ coverage }) => coverage === 'complete-deployment-repair-log-group'
      );
    if (!group) throw new Error('missing deployment repair job group');
    const endpoint = {
      databaseJobId: group.databaseJobId,
      deploymentRunId: group.deploymentRunId,
    };
    invalid.productionEffectProvenance.replayConstraints.relations.push({
      after: endpoint,
      before: endpoint,
      kind: 'job-group-before-job-group',
      reason: 'invalid_self_group_relation',
    });

    expect(() =>
      materializeSupabaseHistoryReplay(invalid, 'production-effect')
    ).toThrow('self-referential replay edge');
  });

  it('rejects extra or incompatible immediate companion relations', () => {
    const extra = cloneVerified();
    extra.productionEffectProvenance.replayConstraints.relations.push(
      structuredClone(immediateCompanionRelation(extra))
    );
    expect(() =>
      materializeSupabaseHistoryReplay(extra, 'production-effect')
    ).toThrow(/companion relation drift/);

    const incompatible = cloneVerified();
    immediateCompanionRelation(incompatible).syntheticCompanion.name =
      'wrong_companion';
    expect(() =>
      materializeSupabaseHistoryReplay(incompatible, 'production-effect')
    ).toThrow(/companion relation drift/);
  });

  it('rejects cycles in the reviewed partial order', () => {
    const invalid = cloneVerified();
    invalid.productionEffectProvenance.replayConstraints.relations.push({
      afterRecordOrdinal: 18,
      beforeRecordOrdinal: 19,
      kind: 'record-before-record',
      reason: 'invalid_test_cycle',
    });

    expect(() =>
      materializeSupabaseHistoryReplay(invalid, 'production-effect')
    ).toThrow('cycle');
  });
});
