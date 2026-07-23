import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalReplayFixtureJson } from './canonical-replay-fixture-json';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';
import { verifyProductionEffectCaptureInputs } from './verify-production-effect-capture-inputs';

const workspaceRoot = path.resolve(import.meta.dirname, '../../../..');
const roots: string[] = [];
const restoredBindings: Array<() => void> = [];

async function copyFixtures(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-capture-inputs-'));
  roots.push(root);
  await cp(
    path.join(workspaceRoot, 'apps/web/tools/db/fixtures'),
    path.join(root, 'apps/web/tools/db/fixtures'),
    { recursive: true }
  );
  return root;
}

afterEach(async () => {
  for (const restore of restoredBindings.splice(0).reverse()) restore();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe('verifyProductionEffectCaptureInputs', () => {
  it('loads exact capture inputs when the semantic output is stale', async () => {
    const root = await copyFixtures();
    await writeFile(
      path.join(root, supabaseHistoryReplayManifest.semanticFixture.path),
      '{"stale":true}\n'
    );

    const result = await verifyProductionEffectCaptureInputs(root);

    expect(result.productionEffectProvenance.evidenceSources).toHaveLength(25);
    expect(result.forwardRepairDeploymentReceipt.deployment.headSha).toBe(
      'bb55d407e01b719a9014c87fb8a8253861b7005d'
    );
  });

  it('rejects provenance evidence that contradicts the exact deployment', async () => {
    const root = await copyFixtures();
    const binding = supabaseHistoryReplayManifest.provenance as {
      path: string;
      sha256: string;
    };
    const fixturePath = path.join(root, binding.path);
    const provenance = JSON.parse(await readFile(fixturePath, 'utf8')) as {
      evidenceSources: Array<{
        databaseJobId: number;
        deploymentRunId: number;
        headSha: string;
      }>;
      exceptionalRecords: Array<{
        evidence: {
          databaseJobId: number;
          deploymentRunId: number;
          headSha: string;
        };
      }>;
    };
    const deploymentRunId = 29561460438;
    const databaseJobId = 87824630957;
    const contradictoryHead = '0'.repeat(40);
    const source = provenance.evidenceSources.find(
      (candidate) =>
        candidate.deploymentRunId === deploymentRunId &&
        candidate.databaseJobId === databaseJobId
    );
    const record = provenance.exceptionalRecords.find(
      (candidate) =>
        candidate.evidence.deploymentRunId === deploymentRunId &&
        candidate.evidence.databaseJobId === databaseJobId
    );
    if (!source || !record) throw new Error('Expected repair evidence');
    source.headSha = contradictoryHead;
    record.evidence.headSha = contradictoryHead;
    const bytes = canonicalReplayFixtureJson(provenance);
    await writeFile(fixturePath, bytes);
    const originalSha256 = binding.sha256;
    binding.sha256 = createHash('sha256').update(bytes).digest('hex');
    restoredBindings.push(() => {
      binding.sha256 = originalSha256;
    });

    await expect(verifyProductionEffectCaptureInputs(root)).rejects.toThrow(
      /deployment evidence binding drift/i
    );
  });
});
