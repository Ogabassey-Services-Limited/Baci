import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { canonicalReplayEffectJson } from './canonical-replay-effect-json';
import { postReplayProductionAttestationReceipt } from './post-replay-production-attestation-receipt';
import { supabaseHistoryReplayManifest } from './supabase-history-replay-manifest';

type LedgerRow = { name: string; version: string };
type RuntimeModule = {
  attestPostReplayProduction: (
    options: { workspaceRoot: string },
    dependencies: {
      createExecutor: (
        root: string
      ) => Promise<(query: string) => Promise<unknown[]>>;
      readEffects: (input: {
        comparisonMode: 'classify';
        effectQuery: string;
        expectedEffectQuerySha256: string;
        executeSelect: (query: string) => Promise<unknown[]>;
        productionFixture: string;
      }) => Promise<unknown>;
      readDeploymentEvidence?: () => Promise<{
        appliedEntries: LedgerRow[];
        databaseJob: { conclusion: string; id: number };
        mergeSha: string;
        run: { conclusion: string; headSha: string; id: number };
        semanticLogSha256: string;
        summary: { applied: number; skipped: number };
      }>;
      readGithubJob: (workspaceRoot: string) => Promise<{
        job: { conclusion: string; headSha: string; id: number; runId: number };
        rawLog: string;
        run: { conclusion: string; headSha: string; id: number };
      }>;
      readTextFile: (path: string) => Promise<string>;
      verifyManifest: (
        root: string,
        options: { pendingRepairState: 'materialized' }
      ) => Promise<unknown>;
    }
  ) => Promise<typeof postReplayProductionAttestationReceipt>;
};

const runtimePath = './attest-post-replay-production';
const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8')
  ) as T;
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const postReplayRows = (): LedgerRow[] =>
  supabaseHistoryReplayManifest.postReplaySources.map(({ repositoryPath }) => {
    const match = path.posix
      .basename(repositoryPath)
      .match(/^(\d{14})_([a-z0-9_]+)[.]sql$/);
    if (!match) throw new Error('invalid manifest source');
    return { name: match[2] as string, version: match[1] as string };
  });
async function loadRuntime(): Promise<RuntimeModule> {
  return (await import(runtimePath)) as RuntimeModule;
}

function dependencies() {
  const frozenLedger = fixture<{ rows: LedgerRow[] }>(
    'linked-migration-ledger.json'
  );
  const frozenEffect = fixture<Record<string, unknown>>(
    'production-history-effects.json'
  );
  const liveEffect = structuredClone(frozenEffect) as {
    digestVector: Array<{ category: string; identity: string; sha256: string }>;
    effectSha256: string;
  };
  const changed = liveEffect.digestVector.find(
    ({ category, identity }) =>
      category === 'constraint' &&
      identity ===
        'public.reconciliation_review.reconciliation_review_issue_type_check'
  );
  if (!changed) throw new Error('missing expected effect digest');
  changed.sha256 =
    postReplayProductionAttestationReceipt.effects.changedComponents[0].liveSha256;
  liveEffect.effectSha256 = sha256(
    canonicalReplayEffectJson(liveEffect.digestVector)
  );
  const executeSelect = vi
    .fn()
    .mockResolvedValue([
      ...frozenLedger.rows.map(({ name, version }) => ({ name, version })),
      ...postReplayRows(),
    ]);
  const verifyManifest = vi
    .fn()
    .mockResolvedValue({ pendingRepairState: 'materialized' });
  const readEffects = vi.fn().mockResolvedValue({
    ...liveEffect,
    effects: frozenEffect.effects,
    scopeVersion: 'baci-p0-effects-v3',
    serverVersionNum: 170006,
    comparison: {
      changedComponents: [
        {
          category: changed.category,
          identity: changed.identity,
          localSha256: changed.sha256,
          productionSha256:
            postReplayProductionAttestationReceipt.effects.changedComponents[0]
              .frozenSha256,
        },
      ],
      mode: 'classify',
      productionEffectSha256: frozenEffect.effectSha256,
    },
  });
  return {
    createExecutor: vi.fn().mockResolvedValue(executeSelect),
    executeSelect,
    readEffects,
    readDeploymentEvidence: vi
      .fn()
      .mockResolvedValue(
        structuredClone(postReplayProductionAttestationReceipt.deployment)
      ),
    readGithubJob: vi.fn().mockResolvedValue({
      job: {
        conclusion: 'success',
        headSha: postReplayProductionAttestationReceipt.deployment.run.headSha,
        id: postReplayProductionAttestationReceipt.deployment.databaseJob.id,
        runId: postReplayProductionAttestationReceipt.deployment.run.id,
      },
      rawLog: '',
      run: postReplayProductionAttestationReceipt.deployment.run,
    }),
    readTextFile: vi
      .fn()
      .mockImplementation(async (filePath: string) =>
        filePath.endsWith('linked-migration-ledger.json')
          ? JSON.stringify(frozenLedger)
          : filePath.endsWith('production-history-effects.json')
            ? JSON.stringify(frozenEffect)
            : 'SELECT reviewed effects'
      ),
    verifyManifest,
  };
}

describe('attestPostReplayProduction', () => {
  it('returns only the bounded receipt after read-only ledger, classified effects, and GitHub evidence checks', async () => {
    const runtime = await loadRuntime();
    const deps = dependencies();

    await expect(
      runtime.attestPostReplayProduction({ workspaceRoot: '/workspace' }, deps)
    ).resolves.toEqual(postReplayProductionAttestationReceipt);

    expect(deps.verifyManifest).toHaveBeenCalledWith('/workspace', {
      pendingRepairState: 'materialized',
    });
    expect(deps.createExecutor).toHaveBeenCalledWith('/workspace');
    expect(deps.executeSelect).toHaveBeenCalledWith(
      'SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version'
    );
    expect(deps.readEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonMode: 'classify',
        productionFixture: expect.any(String),
      })
    );
  });

  it('rejects deployment evidence whose run does not match the frozen receipt', async () => {
    const runtime = await loadRuntime();
    const deps = dependencies();
    deps.readDeploymentEvidence.mockResolvedValueOnce({
      ...structuredClone(postReplayProductionAttestationReceipt.deployment),
      run: { ...postReplayProductionAttestationReceipt.deployment.run, id: 1 },
    });

    await expect(
      runtime.attestPostReplayProduction({ workspaceRoot: '/workspace' }, deps)
    ).rejects.toThrow(/deployment metadata/i);
  });

  it('parses injected GitHub semantic lines before rejecting a non-frozen deployment receipt', async () => {
    const runtime = await loadRuntime();
    const deps = dependencies();
    const [first] = postReplayRows();
    if (!first) throw new Error('expected manifest source');
    const readGithubJob = vi.fn().mockResolvedValue({
      job: {
        conclusion: 'success',
        headSha: postReplayProductionAttestationReceipt.deployment.run.headSha,
        id: postReplayProductionAttestationReceipt.deployment.databaseJob.id,
        runId: postReplayProductionAttestationReceipt.deployment.run.id,
      },
      rawLog: `✓ applied:         ${first.version}  ${first.name}\nMigrations summary: 1 applied, 0 skipped.\n`,
      run: postReplayProductionAttestationReceipt.deployment.run,
    });

    await expect(
      runtime.attestPostReplayProduction(
        { workspaceRoot: '/workspace' },
        { ...deps, readDeploymentEvidence: undefined, readGithubJob }
      )
    ).rejects.toThrow(/deployment applied entries/i);
    expect(readGithubJob).toHaveBeenCalledWith('/workspace');
  });
});
