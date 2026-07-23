import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBoundReplayReceipt } from './read-bound-replay-receipt';
import { forwardRepairDeploymentReceiptSchema } from './schemas/forward-repair-deployment-receipt-schema';
import { githubMigrationSemanticLinesSchema } from './schemas/github-migration-semantic-lines-schema';
import { linkedMigrationLedgerSchema } from './schemas/linked-migration-ledger-schema';
import { productionEffectProvenanceSchema } from './schemas/production-effect-provenance-schema';
import { productionHistoryEffectsSchema } from './schemas/production-history-effects-schema';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';

const fixtures = path.resolve(import.meta.dirname, 'fixtures');
const workspaceRoot = path.resolve(import.meta.dirname, '../../../..');

async function fixture(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(path.join(fixtures, name), 'utf8')
  ) as Record<string, unknown>;
}

describe('Task 8 post-deploy evidence contracts', () => {
  it('accepts the deployed 442-row linked ledger while freezing base registry counts', async () => {
    const parsed = await readBoundReplayReceipt(
      workspaceRoot,
      supabaseHistoryReplayManifest.linkedLedgerFixture,
      'Linked-ledger fixture',
      linkedMigrationLedgerSchema
    );
    expect(parsed.rows).toHaveLength(442);
    expect(
      parsed.rows.slice(-3).map(({ name, version }) => [version, name])
    ).toEqual([
      ['20260714225501', 'reconcile_order_fulfillment_timestamps'],
      ['20260714225502', 'reconcile_domain_event_duplicate_jsonb_operator'],
      ['20260714225503', 'reconcile_customer_order_cancellation_reason'],
    ]);
    expect(parsed.localFileCount).toBe(424);
    expect(parsed.localUniqueVersionCount).toBe(422);
  });

  it('accepts the deployed production effect fixture ledger boundary', async () => {
    const parsed = await readBoundReplayReceipt(
      workspaceRoot,
      supabaseHistoryReplayManifest.productionEffectsFixture,
      'Production-effect fixture',
      productionHistoryEffectsSchema
    );
    expect(parsed.ledger).toEqual({
      rowCount: 442,
      tailVersion: '20260714225503',
    });
    expect(parsed.effectSha256).toBe(
      '71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253'
    );
    expect(
      parsed.digestVector.filter(
        ({ identity }) =>
          identity.startsWith('eventing.resolve_domain_event_duplicate_v1(') ||
          identity.startsWith('public.cancel_order_as_customer(')
      )
    ).toEqual([
      {
        category: 'function',
        identity:
          'eventing.resolve_domain_event_duplicate_v1(p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_data jsonb)',
        sha256:
          '917a159faabe442c5710cf0aba30748dfb4d986e09ee0dd318a82c0b8243ab14',
      },
      {
        category: 'function',
        identity:
          'public.cancel_order_as_customer(p_order_id uuid, p_reason text)',
        sha256:
          'b21dc2134c1aa3df7aed6c8b7a57173b1fed910a04730f901e56622862503556',
      },
    ]);
  });

  it('accepts v5 provenance with 25501 applied and a final complete three-entry job', async () => {
    const parsed = await readBoundReplayReceipt(
      workspaceRoot,
      supabaseHistoryReplayManifest.provenance,
      'Production-effect provenance',
      productionEffectProvenanceSchema
    );
    expect(parsed.evidenceSources).toHaveLength(25);
    expect(parsed.exceptionalRecords[30]?.applied?.version).toBe(
      '20260714225501'
    );
    expect(parsed.replayConstraints.jobGroups.at(-1)).toMatchObject({
      observedMigrationEntryCount: 3,
    });
  });

  it('binds separate forward-repair and semantic receipt bytes', async () => {
    const forwardRepair = await readBoundReplayReceipt(
      workspaceRoot,
      supabaseHistoryReplayManifest.forwardRepairReceipt,
      'Forward-repair deployment receipt',
      forwardRepairDeploymentReceiptSchema
    );
    const semantic = await readBoundReplayReceipt(
      workspaceRoot,
      supabaseHistoryReplayManifest.semanticFixture,
      'GitHub migration semantic fixture',
      githubMigrationSemanticLinesSchema
    );

    expect(forwardRepair.schemaVersion).toBe(1);
    expect(semantic.sources).toHaveLength(
      supabaseHistoryReplayManifest.semanticFixture.sourceCount
    );
  });

  it('rejects semantic corruption inside each post-deploy fixture', async () => {
    const ledger = await fixture('linked-migration-ledger.json');
    const ledgerRows = ledger.rows as Array<{ version: string }>;
    const finalLedgerRow = ledgerRows.at(-1);
    const previousLedgerRow = ledgerRows.at(-2);
    if (!finalLedgerRow || !previousLedgerRow) {
      throw new Error('Expected linked ledger rows');
    }
    finalLedgerRow.version = previousLedgerRow.version;
    expect(() => linkedMigrationLedgerSchema.parse(ledger)).toThrow();

    const effects = await fixture('production-history-effects.json');
    const digestVector = effects.digestVector as Array<{ sha256: string }>;
    const firstDigest = digestVector[0];
    if (!firstDigest) throw new Error('Expected production effect digest');
    firstDigest.sha256 = '0'.repeat(64);
    expect(() => productionHistoryEffectsSchema.parse(effects)).toThrow(
      /effect digest vector hash mismatch/
    );

    const provenance = await fixture('production-effect-provenance.json');
    const records = provenance.exceptionalRecords as Array<{
      recordOrdinal: number;
    }>;
    const firstRecord = records[0];
    const secondRecord = records[1];
    if (!firstRecord || !secondRecord) {
      throw new Error('Expected exceptional records');
    }
    secondRecord.recordOrdinal = firstRecord.recordOrdinal;
    expect(() => productionEffectProvenanceSchema.parse(provenance)).toThrow(
      /recordOrdinal must be unique/
    );
  });

  it('rejects post-deploy fixtures against mismatched manifest hashes', async () => {
    await expect(
      readBoundReplayReceipt(
        workspaceRoot,
        {
          ...supabaseHistoryReplayManifest.linkedLedgerFixture,
          sha256: '0'.repeat(64),
        },
        'Linked-ledger fixture',
        linkedMigrationLedgerSchema
      )
    ).rejects.toThrow(/SHA-256 does not match the frozen binding/);

    await expect(
      readBoundReplayReceipt(
        workspaceRoot,
        {
          ...supabaseHistoryReplayManifest.productionEffectsFixture,
          sha256: '0'.repeat(64),
        },
        'Production-effect fixture',
        productionHistoryEffectsSchema
      )
    ).rejects.toThrow(/SHA-256 does not match the frozen binding/);

    await expect(
      readBoundReplayReceipt(
        workspaceRoot,
        {
          ...supabaseHistoryReplayManifest.forwardRepairReceipt,
          sha256: '0'.repeat(64),
        },
        'Forward-repair deployment receipt',
        forwardRepairDeploymentReceiptSchema
      )
    ).rejects.toThrow(/SHA-256 does not match the frozen binding/);

    await expect(
      readBoundReplayReceipt(
        workspaceRoot,
        {
          ...supabaseHistoryReplayManifest.semanticFixture,
          sha256: '0'.repeat(64),
        },
        'GitHub migration semantic fixture',
        githubMigrationSemanticLinesSchema
      )
    ).rejects.toThrow(/SHA-256 does not match the frozen binding/);
  });
});
