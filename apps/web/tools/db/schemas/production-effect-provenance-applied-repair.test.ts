import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVerifiedReplaySourceHashes } from '../build-verified-replay-source-hashes';
import { productionEffectProvenanceSchema } from './production-effect-provenance-schema';

async function readFixture() {
  return JSON.parse(
    await readFile(
      path.resolve(
        process.cwd(),
        'tools/db/fixtures/production-effect-provenance.json'
      ),
      'utf8'
    )
  ) as { exceptionalRecords: Record<string, unknown>[] };
}

describe('production effect provenance applied repair', () => {
  it('binds every field of the exact applied append-only repair record', async () => {
    const mutations: Array<(record: Record<string, unknown>) => void> = [
      (record) => {
        record.recordOrdinal = 32;
      },
      (record) => {
        record.linkedLedgerOrdinal = 248;
      },
      (record) => {
        record.linkedProductionOnlyOrdinal = 248;
      },
      (record) => {
        record.linkedVersion = '20260629154904';
      },
      (record) => {
        record.linkedName = 'different_fulfillment_migration';
      },
      (record) => {
        record.repositoryOwnerPath =
          'supabase/migrations/20260714225502_reconcile_order_fulfillment_timestamps.sql';
      },
      (record) => {
        record.ownerSha256 = '0'.repeat(64);
      },
      (record) => {
        record.mappingRule = 'canonical';
      },
      (record) => {
        record.exceptionalKinds = ['late_applied'];
      },
      (record) => {
        (record.applied as Record<string, unknown>).version = '20260714225502';
      },
      (record) => {
        (record.applied as Record<string, unknown>).name = 'wrong_repair';
      },
      (record) => {
        (record.evidence as Record<string, unknown>).headSha = '0'.repeat(40);
      },
      (record) => {
        (record.evidence as Record<string, unknown>).deploymentRunId = 1;
      },
      (record) => {
        (record.evidence as Record<string, unknown>).databaseJobId = 1;
      },
      (record) => {
        (record.evidence as Record<string, unknown>).logOrdinal = 2;
      },
      (record) => {
        (record.evidence as Record<string, unknown>).sanitizedJobLogSha256 =
          '0'.repeat(64);
      },
    ];

    for (const [mutationIndex, mutate] of mutations.entries()) {
      const receipt = await readFixture();
      const appliedRepair = receipt.exceptionalRecords.find(
        (record) => record.recordOrdinal === 31
      );
      expect(appliedRepair).toBeDefined();
      if (!appliedRepair) return;
      mutate(appliedRepair);
      const parsed = productionEffectProvenanceSchema.safeParse(receipt);
      if (!parsed.success) continue;
      expect(
        () => buildVerifiedReplaySourceHashes(parsed.data),
        `mutation ${mutationIndex}`
      ).toThrow();
    }
  });
});
