import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalReplayFixtureJson } from './canonical-replay-fixture-json';
import { parseSupabaseHistoryCaptureArguments } from './parse-supabase-history-capture-arguments';
import { parseSupabaseMigrationList } from './parse-supabase-migration-list';
import { persistSupabaseHistoryFixtures } from './persist-supabase-history-fixtures';
import { readGitObjectBytes } from './read-git-object-bytes';
import { readSupabaseHistoryEffects } from './read-supabase-history-effects';
import { replayRepository } from './replay-repository-root';
import { replayCommandRuntime } from './run-replay-command';
import { linkedMigrationLedgerSchema } from './schemas/linked-migration-ledger-schema';
import {
  type ProductionHistoryEffects,
  productionHistoryEffectsSchema,
} from './schemas/production-history-effects-schema';
import { supabaseHistoryEffectQueryContract } from './supabase-history-effect-query-contract';
import { supabaseHistoryReplayManifest as manifest } from './supabase-history-replay-manifest';
import type { ReplayCommand } from './supabase-history-replay-types';

const LEDGER_QUERY =
  'SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version';
const LINKED_INVENTORY_SHA256 =
  'fb3b8a2299e2980b0c5d5fb5312cf610de2afaf5499949adabc8f97353a56725';
const MAX_MANAGEMENT_BYTES = 8 * 1024 * 1024;
const MIGRATION_PATH = /^supabase\/migrations\/(\d{14})_([a-z0-9_]+)\.sql$/;
type SafeEffectResult = {
  diagnostics: ProductionHistoryEffects['diagnostics'];
  digestVector: ProductionHistoryEffects['digestVector'];
  effectSha256: string;
  effects: ProductionHistoryEffects['effects'];
  scopeVersion: 'baci-p0-effects-v3';
  serverVersionNum: 170006;
};
type CaptureDependencies = {
  executeSelect?: (query: string) => Promise<unknown[]>;
  expectedEffectQuerySha256?: string;
  expectedLinkedInventorySha256?: string;
  readEffects?: (input: {
    effectQuery: string;
    expectedEffectQuerySha256: string;
    executeSelect: (query: string) => Promise<unknown[]>;
  }) => Promise<SafeEffectResult>;
  readGitObject?: typeof readGitObjectBytes;
  readTextFile?: (filePath: string) => Promise<string>;
  runCommand?: ReplayCommand;
};
type CaptureOptions = {
  effectsFixtureOutput?: string;
  linkedFixtureOutput?: string;
  refreshEffectsFixture?: boolean;
  verifyOnly?: boolean;
  workspaceRoot: string;
};
const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
async function linkedProjectRef(root: string): Promise<string> {
  const value =
    process.env.SUPABASE_PROJECT_REF ??
    (await readFile(path.join(root, 'supabase/.temp/project-ref'), 'utf8'));
  const projectRef = value.trim();
  if (!/^[a-z0-9]{20}$/.test(projectRef))
    throw new Error('Linked Supabase project reference is unavailable');
  return projectRef;
}
async function managementExecutor(root: string) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
  const projectRef = await linkedProjectRef(root);
  return async (query: string): Promise<unknown[]> => {
    let response: Response;
    try {
      response = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`,
        {
          body: JSON.stringify({ query }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        }
      );
    } catch {
      throw new Error('Supabase management query transport failed');
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || bytes.length > MAX_MANAGEMENT_BYTES) {
      throw new Error('Supabase management query failed');
    }
    try {
      const parsed: unknown = JSON.parse(bytes.toString('utf8'));
      if (!Array.isArray(parsed)) throw new Error('invalid');
      return parsed;
    } catch {
      throw new Error('Supabase management query response was invalid');
    }
  };
}
async function baseLocalRows(
  root: string,
  runCommand: ReplayCommand,
  readObject: typeof readGitObjectBytes
) {
  const { stdout } = await runCommand('git', [
    '--no-replace-objects',
    'ls-tree',
    '-r',
    '--name-only',
    manifest.baseSha,
    '--',
    'supabase/migrations',
  ]);
  const paths = stdout
    .split('\n')
    .filter((entry) => MIGRATION_PATH.test(entry))
    .sort();
  const rows = await Promise.all(
    paths.map(async (repositoryPath) => {
      const match = MIGRATION_PATH.exec(repositoryPath);
      if (!match) throw new Error('Frozen local migration registry is invalid');
      const body = await readObject(
        root,
        `${manifest.baseSha}:${repositoryPath}`
      );
      return {
        name: match[2] as string,
        repositoryPath,
        sha256: sha256(body),
        version: match[1] as string,
      };
    })
  );
  return rows;
}
export async function captureSupabaseHistoryLedger(
  options: CaptureOptions,
  dependencies: CaptureDependencies = {}
): Promise<{ effectSha256: string; linkedRowCount: number }> {
  if (options.verifyOnly && options.refreshEffectsFixture) {
    throw new Error('Capture fixture mode is invalid');
  }
  const root = await realpath(path.resolve(options.workspaceRoot));
  const linkedOutput = await replayRepository.output(
    root,
    options.linkedFixtureOutput ??
      'apps/web/tools/db/fixtures/linked-migration-ledger.json'
  );
  const effectsOutput = await replayRepository.output(
    root,
    options.effectsFixtureOutput ??
      'apps/web/tools/db/fixtures/production-history-effects.json'
  );
  const outputsCollide = linkedOutput.path === effectsOutput.path;
  if (outputsCollide)
    throw new Error('Captured replay fixture outputs must be distinct');
  const readText =
    dependencies.readTextFile ?? ((filePath) => readFile(filePath, 'utf8'));
  const effectQuery = await readText(
    path.join(root, 'apps/web/tools/db/supabase-history-effects.sql')
  );
  const expectedEffectQuerySha256 =
    dependencies.expectedEffectQuerySha256 ??
    supabaseHistoryEffectQueryContract.querySha256;
  if (sha256(effectQuery) !== expectedEffectQuerySha256)
    throw new Error('Reviewed effect query drift');
  const runCommand =
    dependencies.runCommand ?? replayCommandRuntime.create(root);
  const executeSelect =
    dependencies.executeSelect ?? (await managementExecutor(root));
  const readObject = dependencies.readGitObject ?? readGitObjectBytes;
  const readEffects = dependencies.readEffects ?? readSupabaseHistoryEffects;
  const migrationList = parseSupabaseMigrationList(
    (
      await runCommand('supabase', [
        'migration',
        'list',
        '--linked',
        '--workdir',
        root,
      ])
    ).stdout
  );
  let linkedRows: { name: string; version: string }[];
  try {
    linkedRows = (await executeSelect(LEDGER_QUERY)) as typeof linkedRows;
  } catch {
    throw new Error('Linked migration inventory query failed');
  }
  if (
    linkedRows.length !== 439 ||
    linkedRows.at(-1)?.version !== '20260714225500' ||
    sha256(
      linkedRows.map(({ version, name }) => `${version}\t${name}\n`).join('')
    ) !==
      (dependencies.expectedLinkedInventorySha256 ?? LINKED_INVENTORY_SHA256) ||
    linkedRows.some(
      (row, index) =>
        !/^\d{14}$/.test(row.version) ||
        !/^[a-z0-9_]+$/.test(row.name) ||
        (index > 0 && linkedRows[index - 1].version >= row.version)
    )
  ) {
    throw new Error('Linked migration inventory drift');
  }
  const listedRemote = migrationList
    .flatMap(({ remoteVersion }) => (remoteVersion ? [remoteVersion] : []))
    .sort();
  if (
    JSON.stringify(listedRemote) !==
    JSON.stringify(linkedRows.map(({ version }) => version))
  ) {
    throw new Error('Linked migration inventory disagreement');
  }
  const localRows = await baseLocalRows(root, runCommand, readObject);
  const localsByVersion = Map.groupBy(localRows, ({ version }) => version);
  const linkedFixture = linkedMigrationLedgerSchema.parse({
    baseSha: manifest.baseSha,
    linkedRowCount: 439,
    linkedTailVersion: '20260714225500',
    localFileCount: 424,
    localUniqueVersionCount: 422,
    rows: linkedRows.map((row) => {
      const locals = localsByVersion.get(row.version) ?? [];
      return {
        ...row,
        localPaths: locals.map(({ repositoryPath }) => repositoryPath),
        localSha256: locals.map(({ sha256: sourceSha }) => sourceSha),
      };
    }),
    schemaVersion: 1,
  });
  const effectResult = await readEffects({
    effectQuery,
    expectedEffectQuerySha256,
    executeSelect,
  });
  const effectsFixture = productionHistoryEffectsSchema.parse({
    baseSha: manifest.baseSha,
    diagnostics: effectResult.diagnostics,
    digestVector: effectResult.digestVector,
    effectSha256: effectResult.effectSha256,
    effects: effectResult.effects,
    ledger: { rowCount: 439, tailVersion: '20260714225500' },
    schemaVersion: 2,
    scope: {
      componentCount: 76,
      manifestSha256: supabaseHistoryEffectQueryContract.scopeManifestSha256,
      version: effectResult.scopeVersion,
    },
    source: {
      kind: 'supabase-management-api-read-only',
      querySha256: sha256(effectQuery),
      serverVersionNum: effectResult.serverVersionNum,
    },
  });
  await persistSupabaseHistoryFixtures({
    effectsBody: canonicalReplayFixtureJson(effectsFixture),
    effectsOutput,
    linkedBody: canonicalReplayFixtureJson(linkedFixture),
    linkedOutput,
    mode: options.refreshEffectsFixture
      ? 'refresh-effects'
      : options.verifyOnly
        ? 'verify'
        : 'create',
  });
  return {
    effectSha256: effectResult.effectSha256,
    linkedRowCount: linkedFixture.linkedRowCount,
  };
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  Promise.resolve()
    .then(() =>
      captureSupabaseHistoryLedger({
        ...parseSupabaseHistoryCaptureArguments(process.argv.slice(2)),
        workspaceRoot: replayRepository.root(import.meta.dirname),
      })
    )
    .catch(() => {
      process.exitCode = 1;
    });
}
