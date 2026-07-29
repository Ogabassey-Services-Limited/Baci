import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { readGitObjectBytes } from './read-git-object-bytes';
import { resolveSafeReplayPath } from './resolve-safe-replay-path';
import { supabaseHistoryReplayManifest as manifest } from './supabase-history-replay-manifest';
import type {
  HistoricalMigrationRepair,
  PendingRepairState,
  ReplaySource,
  VerifiedReplayManifest,
} from './supabase-history-replay-types';
import { verifyCurrentMigrationRegistry } from './verify-current-migration-registry';
import { verifySupabaseForwardRepairs } from './verify-supabase-forward-repairs';
import { verifySupabaseHistoryReplayReceipts } from './verify-supabase-history-replay-receipts';
import { verifySupabasePostReplaySources } from './verify-supabase-post-replay-sources';

const MAX_GIT_OUTPUT = 32 * 1024 * 1024;
const MIGRATION_PATH = /^supabase\/migrations\/([^/]+[.]sql)$/;

function frozenReplayTailVersion(): string {
  const name = manifest.forwardRepairs.at(-1)?.path.match(MIGRATION_PATH)?.[1];
  const version = name?.match(/^(\d{14})_/)?.[1];
  if (!version) throw new Error('Invalid frozen replay tail source');
  return version;
}

function postReplayTailVersion(): string {
  const name = manifest.postReplaySources
    .at(-1)
    ?.repositoryPath.match(MIGRATION_PATH)?.[1];
  const version = name?.match(/^(\d{14})_/)?.[1];
  if (!version) throw new Error('Invalid post-replay tail source');
  return version;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

async function listBaseMigrationPaths(root: string): Promise<string[]> {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      'git',
      [
        '--no-replace-objects',
        '-C',
        root,
        'ls-tree',
        '-r',
        '--name-only',
        manifest.baseSha,
        '--',
        'supabase/migrations',
      ],
      { encoding: 'utf8', maxBuffer: MAX_GIT_OUTPUT, shell: false },
      (error, output) => {
        if (error) {
          reject(new Error('git ls-tree failed'));
          return;
        }
        resolve(output);
      }
    );
  });
  return stdout
    .split('\n')
    .filter((entry) => MIGRATION_PATH.test(entry))
    .sort();
}

async function verifyRepair(
  root: string,
  state: PendingRepairState
): Promise<void> {
  const repairPath = await resolveSafeReplayPath(
    root,
    manifest.repair.path,
    false
  );
  const exists = await lstat(repairPath).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  );
  if (state === 'not-materialized') {
    if (exists)
      throw new Error('Pending repair must be absent in not-materialized mode');
    return;
  }
  if (!exists)
    throw new Error('Pending repair must exist in materialized mode');
  const body = await readFile(
    await resolveSafeReplayPath(root, manifest.repair.path)
  );
  if (
    sha256(body) !== manifest.repair.sha256 ||
    body.toString('utf8') !== manifest.repair.body
  ) {
    throw new Error(
      'Pending repair SHA-256 or body does not match the frozen repair'
    );
  }
}

function verifyBaseRegistry(registryPaths: readonly string[]): void {
  const versions = new Set(
    registryPaths.map((entry) => path.posix.basename(entry).slice(0, 14))
  );
  if (
    registryPaths.length !== manifest.baseRegistry.fileCount ||
    versions.size !== manifest.baseRegistry.uniqueVersionCount ||
    path.posix.basename(registryPaths.at(-1) ?? '').slice(0, 14) !==
      manifest.baseRegistry.tailVersion
  ) {
    throw new Error('Frozen base migration registry drift');
  }
}

async function verifyCurrentSources(
  root: string,
  registryPaths: readonly string[],
  expectedHashes: ReadonlyMap<string, string>
): Promise<ReplaySource[]> {
  const repairsByPath = new Map<string, HistoricalMigrationRepair>();
  for (const repair of manifest.historicalRepairs) {
    if (repairsByPath.has(repair.repositoryPath)) {
      throw new Error('Duplicate historical migration repair');
    }
    repairsByPath.set(repair.repositoryPath, repair);
  }
  const verifiedSources: ReplaySource[] = [];
  for (const repositoryPath of registryPaths) {
    const frozenBody = await readGitObjectBytes(
      root,
      `${manifest.baseSha}:${repositoryPath}`
    );
    const currentBody = await readFile(
      await resolveSafeReplayPath(root, repositoryPath)
    );
    const frozenSha = sha256(frozenBody);
    const currentSha = sha256(currentBody);
    const repair = repairsByPath.get(repositoryPath);
    if (
      repair
        ? frozenSha !== repair.originalSha256 ||
          currentSha !== repair.repairedSha256
        : currentSha !== frozenSha || !currentBody.equals(frozenBody)
    ) {
      throw new Error(
        repair
          ? `Historical migration repair hash drift: ${repositoryPath}`
          : `Current-tree source drift from git show base: ${repositoryPath}`
      );
    }
    const boundSha = expectedHashes.get(repositoryPath);
    if (boundSha && boundSha !== frozenSha) {
      throw new Error(`Frozen source hash drift: ${repositoryPath}`);
    }
    verifiedSources.push({
      receiptId: `base:${repositoryPath}`,
      repositoryPath,
      sha256: repair ? currentSha : frozenSha,
    });
  }
  if (
    [...repairsByPath.keys()].some(
      (repositoryPath) => !registryPaths.includes(repositoryPath)
    )
  ) {
    throw new Error('Historical migration repair is absent from base');
  }
  const forwardPaths = new Set([
    manifest.repair.path,
    ...manifest.forwardRepairs.map(({ path: repairPath }) => repairPath),
  ]);
  for (const repositoryPath of expectedHashes.keys()) {
    if (
      !registryPaths.includes(repositoryPath) &&
      !forwardPaths.has(repositoryPath)
    ) {
      throw new Error(`Frozen source is absent from base: ${repositoryPath}`);
    }
  }
  return verifiedSources;
}

function verifyBootstrap(
  verifiedSources: readonly ReplaySource[]
): ReplaySource[] {
  const bootstrapSources = verifiedSources.filter(
    ({ repositoryPath }) => repositoryPath <= manifest.bootstrap.tailPath
  );
  const receipt = bootstrapSources
    .map(
      ({ repositoryPath, sha256: sourceSha }) =>
        `${path.posix.basename(repositoryPath)}\t${sourceSha}\n`
    )
    .join('');
  if (
    bootstrapSources.length !== manifest.bootstrap.count ||
    sha256(receipt) !== manifest.bootstrap.receiptSha256 ||
    bootstrapSources.at(-1)?.repositoryPath !== manifest.bootstrap.tailPath ||
    bootstrapSources.at(-1)?.sha256 !== manifest.bootstrap.tailSha256
  ) {
    throw new Error('Bootstrap migration receipt drift');
  }
  return bootstrapSources;
}

export async function verifySupabaseHistoryReplayManifest(
  workspaceRoot: string,
  options: { pendingRepairState: PendingRepairState }
): Promise<VerifiedReplayManifest> {
  if (
    !options ||
    !['materialized', 'not-materialized'].includes(options.pendingRepairState)
  ) {
    throw new Error('pendingRepairState must be explicit');
  }
  const root = await realpath(path.resolve(workspaceRoot));
  await verifyRepair(root, options.pendingRepairState);
  const receipts = await verifySupabaseHistoryReplayReceipts(root);
  const registryPaths = await listBaseMigrationPaths(root);
  verifyBaseRegistry(registryPaths);
  const verifiedSources = await verifyCurrentSources(
    root,
    registryPaths,
    receipts.expectedSourceHashes
  );
  await verifySupabaseForwardRepairs(root, manifest.forwardRepairs);
  const postReplaySources = await verifySupabasePostReplaySources(
    root,
    manifest.postReplaySources,
    frozenReplayTailVersion()
  );
  await verifySupabasePostReplaySources(
    root,
    manifest.pendingSources,
    postReplayTailVersion()
  );
  await verifyCurrentMigrationRegistry(root, [
    ...registryPaths,
    ...(options.pendingRepairState === 'materialized'
      ? [manifest.repair.path]
      : []),
    ...manifest.forwardRepairs.map(({ path: repairPath }) => repairPath),
    ...manifest.postReplaySources.map(({ repositoryPath }) => repositoryPath),
    ...manifest.pendingSources.map(({ repositoryPath }) => repositoryPath),
  ]);
  const bootstrapSources = verifyBootstrap(verifiedSources);
  return {
    bootstrapSources,
    forwardRepairDeploymentReceipt: receipts.forwardRepairDeploymentReceipt,
    manifest,
    migrationNameAliasDeployRepair: receipts.migrationNameAliasDeployRepair,
    pendingRepairState: options.pendingRepairState,
    postReplaySources,
    productionEffectProvenance: receipts.productionEffectProvenance,
    verifiedSources,
  };
}
