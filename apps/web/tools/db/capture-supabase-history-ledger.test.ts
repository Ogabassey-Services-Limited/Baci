import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSupabaseHistoryEffectDigests } from './build-supabase-history-effect-digests';
import { captureSupabaseHistoryLedger } from './capture-supabase-history-ledger';
import { linkedMigrationLedgerSchema } from './schemas/linked-migration-ledger-schema';
import {
  type ProductionHistoryEffects,
  productionHistoryEffectsSchema,
} from './schemas/production-history-effects-schema';
import { summarizeSupabaseHistoryEffects } from './summarize-supabase-history-effects';
import { createSupabaseHistoryEffectTestFixture } from './supabase-history-effect-test-fixture';
import type { ReplayCommand } from './supabase-history-replay-types';
import { validateSupabaseHistoryEffectComponents } from './validate-supabase-history-effect-components';

const roots: string[] = [];
const effectQuery = 'SELECT 1;\n';
const effectSha = createHash('sha256').update(effectQuery).digest('hex');
function version(index: number): string {
  return index === 439
    ? '20260714225500'
    : `202607${String(index).padStart(8, '0')}`;
}
function inventorySha256(rows: readonly { name: string; version: string }[]) {
  return createHash('sha256')
    .update(rows.map(({ version, name }) => `${version}\t${name}\n`).join(''))
    .digest('hex');
}
function captureOptions(workspaceRoot: string) {
  return {
    effectsFixtureOutput: 'effects.json',
    linkedFixtureOutput: 'ledger.json',
    workspaceRoot,
  };
}

type CaptureEffectResult = Pick<
  ProductionHistoryEffects,
  'diagnostics' | 'digestVector' | 'effectSha256' | 'effects'
> & {
  scopeVersion: 'baci-p0-effects-v3';
  serverVersionNum: 170006;
};

function assertSafeEffectSummary(
  effects: ReturnType<typeof summarizeSupabaseHistoryEffects>
): asserts effects is ProductionHistoryEffects['effects'] {
  if (
    effects.componentCount !== 76 ||
    effects.domainEventRpcCount !== 19 ||
    Object.entries(effects).some(([key, value]) => {
      if (key === 'componentCount') return value !== 76;
      if (key === 'domainEventRpcCount') return value !== 19;
      return value !== true;
    })
  ) {
    throw new Error('unsafe effect test fixture');
  }
}

function effectResult(): CaptureEffectResult {
  const snapshot = createSupabaseHistoryEffectTestFixture();
  const components = validateSupabaseHistoryEffectComponents(
    snapshot.components
  );
  const digests = buildSupabaseHistoryEffectDigests(components);
  const effects = summarizeSupabaseHistoryEffects(components);
  assertSafeEffectSummary(effects);
  return {
    diagnostics: snapshot.diagnostics,
    // Validation above narrows every category before the generic digest builder.
    digestVector:
      digests.digestVector as ProductionHistoryEffects['digestVector'],
    effectSha256: digests.effectSha256,
    effects,
    scopeVersion: snapshot.scopeVersion,
    serverVersionNum: 170006,
  };
}
function fixtureData() {
  const ledgerRows = Array.from({ length: 439 }, (_, index) => ({
    name: `migration_${index + 1}`,
    version: version(index + 1),
  }));
  const localPaths = ledgerRows.slice(0, 422).flatMap((row, index) => {
    const paths = [`supabase/migrations/${row.version}_${row.name}.sql`];
    if (index < 2) {
      paths.push(
        `supabase/migrations/${row.version}_${row.name}_companion.sql`
      );
    }
    return paths;
  });
  const bodies = new Map(
    localPaths.map((repositoryPath) => [
      repositoryPath,
      Buffer.from(`-- ${repositoryPath}\n`),
    ])
  );
  const migrationList = [
    '   Local          | Remote         | Time (UTC)',
    '  ----------------|----------------|---------------------',
    ...ledgerRows.map((row, index) => {
      const local = index < 422 ? row.version : '              ';
      return `   ${local} | ${row.version} | 2026-07-01 00:00:00`;
    }),
    '',
  ].join('\n');
  return { bodies, ledgerRows, localPaths, migrationList };
}
async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-ledger-capture-'));
  roots.push(root);
  return root;
}
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
describe('captureSupabaseHistoryLedger', () => {
  it('writes canonical immutable linked-ledger and effect fixtures', async () => {
    const root = await temporaryRoot();
    const data = fixtureData();
    const runCommand: ReplayCommand = vi.fn(async (command) => {
      if (command === 'supabase') {
        return { stderr: '', stdout: data.migrationList };
      }
      if (command === 'git') {
        return { stderr: '', stdout: `${data.localPaths.join('\n')}\n` };
      }
      throw new Error('unexpected command');
    });
    const queries: string[] = [];
    const result = await captureSupabaseHistoryLedger(captureOptions(root), {
      executeSelect: async (query) => {
        queries.push(query);
        return data.ledgerRows;
      },
      expectedEffectQuerySha256: effectSha,
      expectedLinkedInventorySha256: inventorySha256(data.ledgerRows),
      readEffects: async () => effectResult(),
      readGitObject: async (_root, object) => {
        const repositoryPath = object.slice(object.indexOf(':') + 1);
        const body = data.bodies.get(repositoryPath);
        if (!body) throw new Error('missing object');
        return body;
      },
      readTextFile: async () => effectQuery,
      runCommand,
    });
    const ledger = linkedMigrationLedgerSchema.parse(
      JSON.parse(await readFile(path.join(root, 'ledger.json'), 'utf8'))
    );
    const effects = productionHistoryEffectsSchema.parse(
      JSON.parse(await readFile(path.join(root, 'effects.json'), 'utf8'))
    );
    expect(result).toEqual({
      effectSha256: effectResult().effectSha256,
      linkedRowCount: 439,
    });
    expect(queries).toEqual([
      'SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version',
    ]);
    expect(ledger.rows[0].localPaths).toHaveLength(2);
    expect(ledger.rows[0].localSha256[0]).toBe(
      createHash('sha256')
        .update(data.bodies.get(data.localPaths[0]) as Buffer)
        .digest('hex')
    );
    expect(effects.source.querySha256).toBe(effectSha);
    expect(effects.schemaVersion).toBe(2);
    expect(effects.scope).toEqual({
      componentCount: 76,
      manifestSha256:
        'a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245',
      version: 'baci-p0-effects-v3',
    });
    expect(effects.digestVector).toHaveLength(76);
  });
  it('verifies existing fixtures without rewriting them', async () => {
    const root = await temporaryRoot();
    const data = fixtureData();
    const dependencies = {
      executeSelect: async () => data.ledgerRows,
      expectedEffectQuerySha256: effectSha,
      expectedLinkedInventorySha256: inventorySha256(data.ledgerRows),
      readEffects: async () => effectResult(),
      readGitObject: async (_root: string, object: string) =>
        data.bodies.get(object.slice(object.indexOf(':') + 1)) as Buffer,
      readTextFile: async () => effectQuery,
      runCommand: (async (command: string) => ({
        stderr: '',
        stdout:
          command === 'git'
            ? `${data.localPaths.join('\n')}\n`
            : data.migrationList,
      })) as ReplayCommand,
    };
    const options = captureOptions(root);
    await captureSupabaseHistoryLedger(options, dependencies);
    const before = await readFile(path.join(root, 'ledger.json'));
    await captureSupabaseHistoryLedger(
      { ...options, verifyOnly: true },
      dependencies
    );
    expect(await readFile(path.join(root, 'ledger.json'))).toEqual(before);
  });
  it('rejects linked inventory drift and output path escape', async () => {
    const root = await temporaryRoot();
    const data = fixtureData();
    const dependencies = {
      executeSelect: async () => data.ledgerRows.slice(1),
      expectedEffectQuerySha256: effectSha,
      expectedLinkedInventorySha256: inventorySha256(data.ledgerRows),
      readEffects: vi.fn(),
      readGitObject: vi.fn(),
      readTextFile: async () => effectQuery,
      runCommand: (async (command: string) => ({
        stderr: '',
        stdout:
          command === 'git'
            ? `${data.localPaths.join('\n')}\n`
            : data.migrationList,
      })) as ReplayCommand,
    };
    await expect(
      captureSupabaseHistoryLedger(captureOptions(root), dependencies)
    ).rejects.toThrow(/linked migration inventory/i);
    await expect(
      captureSupabaseHistoryLedger(captureOptions(root), {
        ...dependencies,
        executeSelect: async () =>
          data.ledgerRows.map((row, index) =>
            index === 200 ? { ...row, name: 'unknown_live_row' } : row
          ),
      })
    ).rejects.toThrow(/linked migration inventory/i);
    await expect(
      captureSupabaseHistoryLedger(
        {
          effectsFixtureOutput: 'effects.json',
          linkedFixtureOutput: '../ledger.json',
          workspaceRoot: root,
        },
        dependencies
      )
    ).rejects.toThrow(/output path/i);
  });
  it('rejects unreviewed effect SQL before commands or database reads', async () => {
    const root = await temporaryRoot();
    const executeSelect = vi.fn();
    const runCommand = vi.fn();
    await expect(
      captureSupabaseHistoryLedger(captureOptions(root), {
        executeSelect,
        expectedEffectQuerySha256: 'a'.repeat(64),
        readEffects: vi.fn(),
        readGitObject: vi.fn(),
        readTextFile: async () => effectQuery,
        runCommand,
      })
    ).rejects.toThrow(/effect query/i);
    expect(executeSelect).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });
  it('rejects a symlinked fixture parent that escapes the workspace', async () => {
    const root = await temporaryRoot();
    const outside = await temporaryRoot();
    await symlink(outside, path.join(root, 'escape'));
    await expect(
      captureSupabaseHistoryLedger(
        {
          effectsFixtureOutput: 'effects.json',
          linkedFixtureOutput: 'escape/ledger.json',
          workspaceRoot: root,
        },
        {
          executeSelect: vi.fn(),
          readEffects: vi.fn(),
          readGitObject: vi.fn(),
          readTextFile: vi.fn(),
          runCommand: vi.fn(),
        }
      )
    ).rejects.toThrow(/output path/i);
  });
});
