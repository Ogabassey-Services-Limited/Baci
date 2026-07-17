import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalReplayFixtureJson } from './canonical-replay-fixture-json';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';
import { verifySupabaseHistoryReplayReceipts } from './verify-supabase-history-replay-receipts';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../../../..');
const temporaryRoots: string[] = [];
const restoredBindings: Array<() => void> = [];

type MutableBinding = {
  path: string;
  sha256: string;
};

async function copyReceipts() {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-replay-receipts-'));
  temporaryRoots.push(root);
  await cp(
    path.join(WORKSPACE_ROOT, 'apps/web/tools/db/fixtures'),
    path.join(root, 'apps/web/tools/db/fixtures'),
    { recursive: true }
  );
  return root;
}

async function rewriteBoundReceipt(
  root: string,
  binding: MutableBinding,
  mutate: (receipt: Record<string, unknown>) => void
): Promise<void> {
  const fixture = path.join(root, binding.path);
  const receipt = JSON.parse(await readFile(fixture, 'utf8')) as Record<
    string,
    unknown
  >;
  mutate(receipt);
  const bytes = canonicalReplayFixtureJson(receipt);
  await writeFile(fixture, bytes);
  const originalSha256 = binding.sha256;
  binding.sha256 = createHash('sha256').update(bytes).digest('hex');
  restoredBindings.push(() => {
    binding.sha256 = originalSha256;
  });
}

afterEach(async () => {
  for (const restore of restoredBindings.splice(0).reverse()) {
    restore();
  }
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('verifySupabaseHistoryReplayReceipts', () => {
  it('returns only exact schema-validated canonical receipt data', async () => {
    const result = await verifySupabaseHistoryReplayReceipts(WORKSPACE_ROOT);
    expect(result.productionEffectProvenance.evidenceSources).toHaveLength(25);
    expect(result.productionEffectProvenance.exceptionalRecords).toHaveLength(
      31
    );
    expect(result.expectedSourceHashes.size).toBe(61);
    expect(
      result.expectedSourceHashes.get(
        'supabase/migrations/20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql'
      )
    ).toBe('537f5654e8ca811d926fe0642d410e13c13c39703bba8a7d18372a8000784263');
    expect(
      result.expectedSourceHashes.get(
        'supabase/migrations/20260714225503_reconcile_customer_order_cancellation_reason.sql'
      )
    ).toBe('6c5f9ca9ed75b63e241f25e1dddfab9b2d7da1bab7cb91694b92a1d9548d7a71');
    expect(result.migrationNameAliasDeployRepair.alias.disposition).toBe(
      'already-applied-no-ledger-write'
    );
  });

  it('rejects receipt bytes that no longer match the canonical binding', async () => {
    const root = await copyReceipts();
    const fixture = path.join(
      root,
      'apps/web/tools/db/fixtures/production-effect-provenance.json'
    );
    await writeFile(
      fixture,
      (await readFile(fixture, 'utf8')).replace(
        'partial-order-effect-replay',
        'drift'
      )
    );
    await expect(verifySupabaseHistoryReplayReceipts(root)).rejects.toThrow(
      /provenance|canonical/i
    );
  });

  it('reports a base SHA mismatch independently of alias leakage', async () => {
    const root = await copyReceipts();
    await rewriteBoundReceipt(
      root,
      supabaseHistoryReplayManifest.aliasReceipt as MutableBinding,
      (receipt) => {
        receipt.baseSha = '0'.repeat(40);
        receipt.repairCommitSha = '0'.repeat(40);
        const successfulRepairAttempt = receipt.successfulRepairAttempt as {
          headSha: string;
        };
        successfulRepairAttempt.headSha = '0'.repeat(40);
      }
    );

    await expect(verifySupabaseHistoryReplayReceipts(root)).rejects.toThrow(
      'Migration-name alias receipt baseSha does not match the frozen manifest'
    );
  });

  it('reports an alias version leak independently of the base SHA', async () => {
    const root = await copyReceipts();
    const aliasReceipt = JSON.parse(
      await readFile(
        path.join(root, supabaseHistoryReplayManifest.aliasReceipt.path),
        'utf8'
      )
    ) as { alias: { version: string } };
    await rewriteBoundReceipt(
      root,
      supabaseHistoryReplayManifest.provenance as MutableBinding,
      (receipt) => {
        const exceptionalRecords = receipt.exceptionalRecords as Array<{
          applied: { version: string } | null;
        }>;
        const firstApplied = exceptionalRecords.find(
          (record) => record.applied !== null
        )?.applied;
        if (!firstApplied) {
          throw new Error('Expected an applied exceptional record');
        }
        firstApplied.version = aliasReceipt.alias.version;
      }
    );

    await expect(verifySupabaseHistoryReplayReceipts(root)).rejects.toThrow(
      'Migration-name alias version leaked into production-effect provenance'
    );
  });
});
