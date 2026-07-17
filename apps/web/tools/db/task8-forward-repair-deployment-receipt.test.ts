import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalReplayFixtureJson } from './canonical-replay-fixture-json';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';
import { verifySupabaseHistoryReplayReceipts } from './verify-supabase-history-replay-receipts';

const workspaceRoot = path.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('Task 8 forward-repair deployment receipt', () => {
  it('is separately bound from historical production-only mappings', async () => {
    const verified = (await verifySupabaseHistoryReplayReceipts(
      workspaceRoot
    )) as unknown as {
      forwardRepairDeploymentReceipt: {
        deployment: { databaseJobId: number; runId: number };
        repairs: Array<{ logOrdinal: number; path: string }>;
      };
      productionEffectProvenance: {
        exceptionalRecords: Array<{ repositoryOwnerPath: string }>;
      };
    };

    expect(verified.forwardRepairDeploymentReceipt.deployment).toMatchObject({
      databaseJobId: 87824630957,
      runId: 29561460438,
    });
    expect(
      verified.forwardRepairDeploymentReceipt.repairs.map(
        ({ logOrdinal, path: repairPath }) => [logOrdinal, repairPath]
      )
    ).toEqual([
      [
        2,
        'supabase/migrations/20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql',
      ],
      [
        3,
        'supabase/migrations/20260714225503_reconcile_customer_order_cancellation_reason.sql',
      ],
    ]);
    const historicalPaths = new Set(
      verified.productionEffectProvenance.exceptionalRecords.map(
        ({ repositoryOwnerPath }) => repositoryOwnerPath
      )
    );
    expect(
      verified.forwardRepairDeploymentReceipt.repairs.some(({ path: value }) =>
        historicalPaths.has(value)
      )
    ).toBe(false);
  });

  it('fails closed if a bound repair log ordinal is changed', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'baci-forward-receipt-'));
    roots.push(root);
    await cp(
      path.join(workspaceRoot, 'apps/web/tools/db/fixtures'),
      path.join(root, 'apps/web/tools/db/fixtures'),
      { recursive: true }
    );
    const manifest = supabaseHistoryReplayManifest as unknown as {
      forwardRepairReceipt: { path: string; sha256: string };
    };
    expect(manifest.forwardRepairReceipt).toBeDefined();
    if (!manifest.forwardRepairReceipt) return;
    const receiptPath = path.join(root, manifest.forwardRepairReceipt.path);
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as {
      repairs: Array<{ logOrdinal: number }>;
    };
    receipt.repairs[0].logOrdinal = 1;
    await writeFile(receiptPath, canonicalReplayFixtureJson(receipt));

    await expect(verifySupabaseHistoryReplayReceipts(root)).rejects.toThrow(
      /forward-repair|SHA-256|schema/i
    );
  });
});
