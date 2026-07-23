import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  SUPABASE_REPLAY_PORT_KEYS,
  type SupabaseReplayPortMap,
} from './allocate-supabase-replay-ports';
import type { ReplayCommand } from './supabase-history-replay-types';
import {
  assertSupabaseReplayResources,
  type ExpectedSupabaseReplayResources,
  type ObservedSupabaseReplayResources,
} from './supabase-replay-expected-resources';

export type ReplayProjectOwnership = {
  originalConfigSha256: string;
  ports: SupabaseReplayPortMap;
  preStartEmpty: { containers: true; networks: true; volumes: true };
  projectId: string;
  rewrittenConfigSha256: string;
  schemaVersion: 1;
  workdir: string;
};

export type ReplayProjectCleanupResult = {
  resourceReadiness: 'anomalous' | 'verified';
};

export function replayProjectOwnershipPath(workdir: string): string {
  return path.join(workdir, '.baci-supabase-replay-owner.json');
}

function validHash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function validProjectId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{2,62}$/.test(value);
}

function validPorts(value: unknown): value is SupabaseReplayPortMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === SUPABASE_REPLAY_PORT_KEYS.length &&
    SUPABASE_REPLAY_PORT_KEYS.every(
      (key) =>
        Object.hasOwn(record, key) &&
        Number.isInteger(record[key]) &&
        Number(record[key]) >= 1024 &&
        Number(record[key]) <= 65_535
    ) &&
    new Set(SUPABASE_REPLAY_PORT_KEYS.map((key) => record[key])).size ===
      SUPABASE_REPLAY_PORT_KEYS.length
  );
}

async function canonicalOwnedWorkdir(
  ownedTempRoot: string,
  workdir: string
): Promise<string> {
  const [root, owned] = await Promise.all([
    realpath(ownedTempRoot),
    realpath(workdir),
  ]);
  const relative = path.relative(root, owned);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Replay workdir is outside the owned temporary root');
  }
  return owned;
}

export async function createReplayProjectOwnership(options: {
  originalConfigSha256: string;
  ownedTempRoot: string;
  ports: SupabaseReplayPortMap;
  preStartEmpty: { containers: true; networks: true; volumes: true };
  projectId: string;
  rewrittenConfigSha256: string;
  workdir: string;
}): Promise<ReplayProjectOwnership> {
  const workdir = await canonicalOwnedWorkdir(
    options.ownedTempRoot,
    options.workdir
  );
  if (
    !validHash(options.originalConfigSha256) ||
    !validHash(options.rewrittenConfigSha256) ||
    !validProjectId(options.projectId) ||
    !validPorts(options.ports) ||
    !options.preStartEmpty.containers ||
    !options.preStartEmpty.networks ||
    !options.preStartEmpty.volumes
  ) {
    throw new Error('Invalid replay ownership input');
  }
  return {
    originalConfigSha256: options.originalConfigSha256,
    ports: options.ports,
    preStartEmpty: {
      containers: true,
      networks: true,
      volumes: true,
    },
    projectId: options.projectId,
    rewrittenConfigSha256: options.rewrittenConfigSha256,
    schemaVersion: 1,
    workdir,
  };
}

export async function writeReplayProjectOwnership(
  ownership: ReplayProjectOwnership
): Promise<void> {
  try {
    await writeFile(
      replayProjectOwnershipPath(ownership.workdir),
      `${JSON.stringify(ownership)}\n`,
      { flag: 'wx', mode: 0o600 }
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Replay ownership marker already exists');
    }
    throw new Error('Replay ownership marker write failed');
  }
}

export async function readReplayProjectOwnership(
  markerPath: string,
  expected: {
    ownedTempRoot: string;
    ports: SupabaseReplayPortMap;
    projectId: string;
    workdir: string;
  }
): Promise<ReplayProjectOwnership> {
  try {
    const workdir = await canonicalOwnedWorkdir(
      expected.ownedTempRoot,
      expected.workdir
    );
    const canonicalMarkerPath = path.join(
      await realpath(path.dirname(markerPath)),
      path.basename(markerPath)
    );
    if (canonicalMarkerPath !== replayProjectOwnershipPath(workdir)) {
      throw new Error();
    }
    if ((await lstat(canonicalMarkerPath)).isSymbolicLink()) throw new Error();
    const bytes = await readFile(canonicalMarkerPath, 'utf8');
    const value = JSON.parse(bytes) as Record<string, unknown>;
    const expectedKeys = [
      'originalConfigSha256',
      'ports',
      'preStartEmpty',
      'projectId',
      'rewrittenConfigSha256',
      'schemaVersion',
      'workdir',
    ];
    const preStartEmpty = value.preStartEmpty as
      | Record<string, unknown>
      | undefined;
    const markerPorts = value.ports;
    if (
      JSON.stringify(Object.keys(value)) !== JSON.stringify(expectedKeys) ||
      value.schemaVersion !== 1 ||
      value.workdir !== workdir ||
      value.projectId !== expected.projectId ||
      !validProjectId(value.projectId) ||
      !validHash(String(value.originalConfigSha256)) ||
      !validHash(String(value.rewrittenConfigSha256)) ||
      !validPorts(markerPorts) ||
      !SUPABASE_REPLAY_PORT_KEYS.every(
        (key) => markerPorts[key] === expected.ports[key]
      ) ||
      !preStartEmpty ||
      JSON.stringify(Object.keys(preStartEmpty)) !==
        JSON.stringify(['containers', 'networks', 'volumes']) ||
      !preStartEmpty.containers ||
      !preStartEmpty.networks ||
      !preStartEmpty.volumes ||
      `${JSON.stringify(value)}\n` !== bytes
    ) {
      throw new Error();
    }
    return value as ReplayProjectOwnership;
  } catch {
    throw new Error('Invalid replay ownership marker');
  }
}

export async function stopOwnedReplayProject(options: {
  expectedResources?: ExpectedSupabaseReplayResources;
  inspectResources: () => Promise<ObservedSupabaseReplayResources>;
  ownedTempRoot: string;
  ownership: ReplayProjectOwnership;
  runCommand: ReplayCommand;
}): Promise<ReplayProjectCleanupResult> {
  const marker = await readReplayProjectOwnership(
    replayProjectOwnershipPath(options.ownership.workdir),
    {
      ownedTempRoot: options.ownedTempRoot,
      ports: options.ownership.ports,
      projectId: options.ownership.projectId,
      workdir: options.ownership.workdir,
    }
  );
  if (
    marker.originalConfigSha256 !== options.ownership.originalConfigSha256 ||
    marker.rewrittenConfigSha256 !== options.ownership.rewrittenConfigSha256
  ) {
    throw new Error('Invalid replay ownership marker');
  }
  try {
    const configPath = path.join(
      options.ownership.workdir,
      'supabase/config.toml'
    );
    if ((await realpath(configPath)) !== configPath) throw new Error();
    const actualConfigSha256 = createHash('sha256')
      .update(await readFile(configPath))
      .digest('hex');
    if (actualConfigSha256 !== marker.rewrittenConfigSha256) throw new Error();
  } catch {
    throw new Error('Invalid replay ownership config');
  }
  let resourceReadiness: ReplayProjectCleanupResult['resourceReadiness'] =
    'verified';
  if (options.expectedResources) {
    try {
      assertSupabaseReplayResources(
        await options.inspectResources(),
        options.expectedResources,
        { allowPartial: true, projectId: options.ownership.projectId }
      );
    } catch {
      resourceReadiness = 'anomalous';
    }
  }
  await options.runCommand('supabase', [
    'stop',
    '--no-backup',
    '--workdir',
    options.ownership.workdir,
  ]);
  const remaining = await options.inspectResources();
  if (
    remaining.containers.length > 0 ||
    remaining.networks.length > 0 ||
    remaining.volumes.length > 0
  ) {
    throw new Error('Supabase replay resources remain after stop');
  }
  return { resourceReadiness };
}
