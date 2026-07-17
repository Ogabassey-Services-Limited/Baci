import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVerifiedReplaySourceHashes } from './build-verified-replay-source-hashes';
import { productionEffectProvenanceSchema } from './schemas/production-effect-provenance-schema';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';

const FIXTURE_PATH = path.resolve(
  import.meta.dirname,
  'fixtures/production-effect-provenance.json'
);

async function loadProvenance() {
  return productionEffectProvenanceSchema.parse(
    JSON.parse(await readFile(FIXTURE_PATH, 'utf8'))
  );
}

describe('buildVerifiedReplaySourceHashes', () => {
  it('returns every manifest- and provenance-bound source hash', async () => {
    const provenance = await loadProvenance();
    const hashes = buildVerifiedReplaySourceHashes(provenance);

    expect(hashes.size).toBe(61);
    expect(
      hashes.get(
        'supabase/migrations/20260712150001_domain_event_pipeline_tables.sql'
      )
    ).toBe('4f31649ba4c9c3d6b5eb4110dbb0d144237502642d61c0606e15a9b1ba39556b');
    expect(
      hashes.get(
        'supabase/migrations/20260702024830_fix_search_products_condition_filter.sql'
      )
    ).toBe('d94d9d87b238c217a8640c9e5b2ef57263ff2112015fac7e2f40de2a91270ed3');
    expect(
      hashes.get(
        'supabase/migrations/20260615120000_customer_order_cancellation.sql'
      )
    ).toBe('acb7406d4975c5cd8d3964e86b991b51046b6f750d49b3769699b878b92192d3');
    expect(
      hashes.get(
        'supabase/migrations/20260713140000_quiz_finalize_rank_winners_reapply.sql'
      )
    ).toBe('f3461eead2451852ecc9a643f34ca486207ea6b10b8ef3439e69718e738acd8c');
    expect(
      hashes.get(
        'supabase/migrations/20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql'
      )
    ).toBe('537f5654e8ca811d926fe0642d410e13c13c39703bba8a7d18372a8000784263');
    expect(
      hashes.get(
        'supabase/migrations/20260714225503_reconcile_customer_order_cancellation_reason.sql'
      )
    ).toBe('6c5f9ca9ed75b63e241f25e1dddfab9b2d7da1bab7cb91694b92a1d9548d7a71');
    const forwardRepairPaths = new Set(
      supabaseHistoryReplayManifest.forwardRepairs.map(({ path }) => path)
    );
    expect(
      provenance.exceptionalRecords.some(({ repositoryOwnerPath }) =>
        forwardRepairPaths.has(repositoryOwnerPath)
      )
    ).toBe(false);
  });

  it('rejects owner-hash drift', async () => {
    const provenance = await loadProvenance();
    provenance.exceptionalRecords[0].ownerSha256 = '0'.repeat(64);

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /binding|mapping|source hash/i
    );
  });

  it('rejects a repair applied name that differs from its canonical path', async () => {
    const provenance = await loadProvenance();
    const repair = provenance.exceptionalRecords.find(
      ({ repositoryOwnerPath }) =>
        repositoryOwnerPath === supabaseHistoryReplayManifest.repair.path
    );
    if (!repair) throw new Error('Expected the applied repair record');
    (repair.applied as { name: string }).name = 'wrong_repair';

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /migration identity/i
    );
  });

  it('rejects a repair linked name that differs from its canonical ledger row', async () => {
    const provenance = await loadProvenance();
    const repair = provenance.exceptionalRecords.find(
      ({ repositoryOwnerPath }) =>
        repositoryOwnerPath === supabaseHistoryReplayManifest.repair.path
    );
    if (!repair || !('linkedName' in repair)) {
      throw new Error('Expected the linked repair record');
    }
    (repair as { linkedName: string }).linkedName = 'wrong_linked_repair';

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /migration identity/i
    );
  });

  it('rejects a linked record applied name that differs from its canonical path', async () => {
    const provenance = await loadProvenance();
    const linked = provenance.exceptionalRecords.find(
      (record) =>
        'linkedVersion' in record && record.mappingRule === 'canonical'
    );
    if (!linked) throw new Error('Expected a linked record');
    linked.applied.name = 'wrong_linked_record';

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /migration identity/i
    );
  });

  it('rejects a linked record name that differs from its canonical ledger row', async () => {
    const provenance = await loadProvenance();
    const linked = provenance.exceptionalRecords.find(
      (record) =>
        'linkedVersion' in record &&
        record.mappingRule === 'superseded-final-state'
    );
    if (!linked || !('linkedName' in linked)) {
      throw new Error('Expected a superseded linked record');
    }
    linked.linkedName = 'wrong_linked_record';

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /migration identity/i
    );
  });

  it('rejects evidence drift', async () => {
    const provenance = await loadProvenance();
    const record = provenance.exceptionalRecords[0];
    if (record.applied === null) throw new Error('Expected an applied record');
    record.evidence.sanitizedJobLogSha256 = '0'.repeat(64);

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /primary evidence/i
    );
  });

  it('rejects a duplicate log ordinal within exact job evidence', async () => {
    const provenance = await loadProvenance();
    const record = provenance.exceptionalRecords[6];
    if (record.applied === null) throw new Error('Expected an applied record');
    record.evidence.logOrdinal = 1;
    const group = provenance.replayConstraints.jobGroups.find(
      (candidate) =>
        'includedRecords' in candidate &&
        candidate.includedRecords.some(
          ({ recordOrdinal }) => recordOrdinal === record.recordOrdinal
        )
    );
    if (!group || !('includedRecords' in group)) {
      throw new Error('Expected an included-record group');
    }
    const included = group.includedRecords.find(
      ({ recordOrdinal }) => recordOrdinal === record.recordOrdinal
    );
    if (!included) throw new Error('Expected an included record');
    included.logOrdinal = 1;

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /record evidence identity/i
    );
  });

  it('requires one relation for every duplicate-group version', async () => {
    const provenance = await loadProvenance();
    const relations = provenance.replayConstraints.relations.filter(
      (relation) => relation.kind === 'duplicate-version-companion'
    );
    const first = relations[0];
    const second = relations[1];
    if (!first || !second) throw new Error('Expected duplicate relations');
    first.ownerRecordOrdinal = second.ownerRecordOrdinal;
    first.syntheticCompanion = structuredClone(second.syntheticCompanion);

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /duplicate-version relation coverage/i
    );
  });

  it('rejects constraint cross-reference drift', async () => {
    const provenance = await loadProvenance();
    const relation = provenance.replayConstraints.relations.find(
      (candidate) => candidate.kind === 'record-before-record'
    );
    if (!relation) throw new Error('Expected a record-order relation');
    relation.beforeRecordOrdinal = 999;

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /relation cross-reference/i
    );
  });

  it('rejects a pipeline job group without exact primary evidence', async () => {
    const provenance = await loadProvenance();
    const pipelineGroup = provenance.replayConstraints.jobGroups.find(
      (group) => 'pipelineRecords' in group
    );
    if (!pipelineGroup) throw new Error('Expected a pipeline job group');
    pipelineGroup.deploymentRunId = 999;
    pipelineGroup.databaseJobId = 999;

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /job-group primary evidence binding/i
    );
  });

  it('rejects primary evidence without an exact job group', async () => {
    const provenance = await loadProvenance();
    const pipelineIndex = provenance.replayConstraints.jobGroups.findIndex(
      (group) => 'pipelineRecords' in group
    );
    if (pipelineIndex === -1) throw new Error('Expected a pipeline job group');
    provenance.replayConstraints.jobGroups.splice(pipelineIndex, 1);

    expect(() => buildVerifiedReplaySourceHashes(provenance)).toThrow(
      /job-group primary evidence binding/i
    );
  });
});
