import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSupabaseHistoryEffectDigests } from './build-supabase-history-effect-digests';
import { replayCommandRuntime } from './run-replay-command';
import { productionHistoryEffectsSchema } from './schemas/production-history-effects-schema';
import { summarizeSupabaseHistoryEffects } from './summarize-supabase-history-effects';
import { supabaseHistoryEffectQueryContract } from './supabase-history-effect-query-contract';
import { createSupabaseHistoryEffectTestFixture } from './supabase-history-effect-test-fixture';
import type { ReplayCommand } from './supabase-history-replay-types';
import { validateSupabaseHistoryEffectComponents } from './validate-supabase-history-effect-components';

const temporaryRoots: string[] = [];
const localDatabaseUrl = 'postgresql://postgres:secret@127.0.0.1:6543/postgres';

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true }))
  );
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-replay-effects-'));
  temporaryRoots.push(root);
  return root;
}

function runReplayEffectOptions(
  repositoryRoot: string,
  runCommand: ReplayCommand
) {
  return {
    databaseUrl: localDatabaseUrl,
    psqlBin: '/owned/psql',
    repositoryRoot,
    runCommand,
  };
}

async function writeBoundSources(root: string, fixture = '{}') {
  const tools = path.join(root, 'apps/web/tools/db');
  await mkdir(path.join(tools, 'fixtures'), { recursive: true });
  const reviewedQuery = await readFile(
    path.join(import.meta.dirname, 'supabase-history-effects.sql'),
    'utf8'
  );
  await writeFile(
    path.join(tools, 'supabase-history-effects.sql'),
    reviewedQuery
  );
  await writeFile(
    path.join(tools, 'fixtures/production-history-effects.json'),
    fixture
  );
}

function productionFixture() {
  const snapshot = createSupabaseHistoryEffectTestFixture();
  const components = validateSupabaseHistoryEffectComponents(
    snapshot.components
  );
  const digests = buildSupabaseHistoryEffectDigests(components);
  return {
    fixture: productionHistoryEffectsSchema.parse({
      baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47',
      diagnostics: snapshot.diagnostics,
      digestVector: digests.digestVector,
      effectSha256: digests.effectSha256,
      effects: summarizeSupabaseHistoryEffects(components),
      ledger: { rowCount: 442, tailVersion: '20260714225503' },
      schemaVersion: 2,
      scope: {
        componentCount: 76,
        manifestSha256: supabaseHistoryEffectQueryContract.scopeManifestSha256,
        version: supabaseHistoryEffectQueryContract.scopeVersion,
      },
      source: {
        kind: 'supabase-management-api-read-only',
        querySha256: supabaseHistoryEffectQueryContract.querySha256,
        serverVersionNum: 170006,
      },
    }),
    snapshot,
  };
}

describe('executeReplaySelect', () => {
  it('uses argv-only psql and parses its bounded output shapes', async () => {
    const runCommand = vi
      .fn<ReplayCommand>()
      .mockResolvedValueOnce({
        stderr: '',
        stdout: '{"scopeVersion":"baci-p0-effects-v3"}\n',
      })
      .mockResolvedValueOnce({ stderr: '', stdout: '170006|on\n' });
    await expect(
      replayCommandRuntime.executeSelect({
        databaseUrl: localDatabaseUrl,
        psqlBin: '/owned/psql',
        runCommand,
        sql: 'SELECT 1',
      })
    ).resolves.toEqual([{ snapshot: { scopeVersion: 'baci-p0-effects-v3' } }]);
    expect(runCommand.mock.calls[0]?.[1]).toEqual([
      '-X',
      '-w',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ]);
    expect(runCommand.mock.calls[0]?.[2]?.env).toMatchObject({
      PGCONNECT_TIMEOUT: '5',
      PGOPTIONS: '-c default_transaction_read_only=on',
    });
    await expect(
      replayCommandRuntime.executeSelect({
        databaseUrl: localDatabaseUrl,
        psqlBin: '/owned/psql',
        runCommand,
        sql: 'SELECT preflight',
      })
    ).resolves.toEqual([
      { serverVersionNum: 170006, transactionReadOnly: 'on' },
    ]);
  });

  it('sanitizes malformed query output', async () => {
    const runCommand = vi.fn<ReplayCommand>(async () => ({
      stderr: '',
      stdout: 'credential=secret',
    }));
    await expect(
      replayCommandRuntime.executeSelect({
        databaseUrl: localDatabaseUrl,
        psqlBin: '/owned/psql',
        runCommand,
        sql: 'SELECT 1',
      })
    ).rejects.toThrow(/^Effect query output is invalid$/);
  });

  it('binds the reviewed query before fixture validation', async () => {
    const root = await temporaryRoot();
    await writeBoundSources(root);
    const runCommand = vi.fn<ReplayCommand>();
    await expect(
      replayCommandRuntime.readBoundEffects(
        runReplayEffectOptions(root, runCommand)
      )
    ).rejects.toThrow(/^production effect receipt mismatch$/);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('rejects reviewed query drift before invoking psql', async () => {
    const root = await temporaryRoot();
    await writeBoundSources(root);
    await writeFile(
      path.join(root, 'apps/web/tools/db/supabase-history-effects.sql'),
      'SELECT 1'
    );
    const runCommand = vi.fn<ReplayCommand>();
    await expect(
      replayCommandRuntime.readBoundEffects(
        runReplayEffectOptions(root, runCommand)
      )
    ).rejects.toThrow(/^Reviewed effect query drift$/);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('threads classify mode into the bound production comparison', async () => {
    const root = await temporaryRoot();
    const { fixture, snapshot } = productionFixture();
    await writeBoundSources(root, JSON.stringify(fixture));
    const runCommand = vi
      .fn<ReplayCommand>()
      .mockResolvedValueOnce({ stderr: '', stdout: '170006|on\n' })
      .mockResolvedValueOnce({
        stderr: '',
        stdout: `${JSON.stringify(snapshot)}\n`,
      });
    const result = await replayCommandRuntime.readBoundEffects({
      ...runReplayEffectOptions(root, runCommand),
      comparisonMode: 'classify',
    });
    expect(result.comparison).toMatchObject({
      changedComponents: [],
      converged: false,
      mode: 'classify',
    });
  });
});
