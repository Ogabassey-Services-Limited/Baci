import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { cloudflareEvidencePrepare } from './cloudflare-evidence-prepare';
import type { EvidenceRunInput } from './cloudflare-evidence-run-journal';
import { buildClosedEvidenceProcessEnvironment } from './qualify-cloudflare-evidence-sources';

export type EvidenceChildCommand = 'prepare' | 'mutate' | 'cleanup' | 'measure';
export type EvidenceProcessSpawner = Readonly<{
  spawn(
    executable: string,
    argv: readonly string[],
    options: Readonly<{ cwd: string; env: Record<string, string> }>
  ): Promise<void>;
}>;
type Credential = Readonly<{
  name: 'CLOUDFLARE_WRITE_TOKEN' | 'CLOUDFLARE_READ_TOKEN';
  value: string;
}>;

const argumentsFor = (
  command: EvidenceChildCommand,
  runId: string,
  prepareInput?: EvidenceRunInput
) => {
  if (command === 'prepare') {
    if (!prepareInput) throw new Error('prepare input is required');
    return cloudflareEvidencePrepare.argumentsFor(prepareInput);
  }
  if (command === 'cleanup') return ['--cleanup-run', runId];
  if (command === 'mutate') return ['--run', runId, '--apply'];
  return ['--run', runId];
};
const scriptFor = (command: EvidenceChildCommand) =>
  command === 'prepare'
    ? 'qualify-cloudflare-evidence-sources.ts'
    : command === 'measure'
      ? 'measure-cloudflare-evidence-sources.ts'
      : 'mutate-cloudflare-evidence-sources.ts';
const pinnedTsx = (workspaceRoot: string) =>
  resolve(workspaceRoot, 'node_modules/.bin/tsx');
const absoluteToolPath = (
  workspaceRoot: string,
  command: EvidenceChildCommand
) => resolve(workspaceRoot, 'apps/web/tools/cost', scriptFor(command));

/** Spawns exactly one purpose-bound command with a closed environment and one credential. */
export async function spawnIsolatedCloudflareEvidenceProcess(
  spawner: EvidenceProcessSpawner,
  command: EvidenceChildCommand,
  runId: string,
  inherited: Readonly<Record<string, string | undefined>>,
  credential: Credential | undefined,
  workspaceRoot: string,
  stateDir: string,
  prepareInput?: EvidenceRunInput
) {
  if (!isAbsolute(workspaceRoot) || !isAbsolute(stateDir))
    throw new Error(
      'workspace root and evidence state directory must be absolute'
    );
  const needsCredential = command !== 'prepare';
  if (needsCredential !== Boolean(credential))
    throw new Error('command credential responsibility is invalid');
  if (
    (command === 'mutate' || command === 'cleanup') &&
    credential?.name !== 'CLOUDFLARE_WRITE_TOKEN'
  )
    throw new Error('write command requires only the write credential');
  if (command === 'measure' && credential?.name !== 'CLOUDFLARE_READ_TOKEN')
    throw new Error('measurement requires only the read credential');
  const privateHome = await mkdtemp(join(tmpdir(), 'baci-evidence-home-'));
  const env = credential
    ? buildClosedEvidenceProcessEnvironment(
        credential.name,
        credential.value,
        inherited
      )
    : Object.fromEntries(
        ['PATH', 'TMPDIR']
          .filter((name) => inherited[name])
          .map((name) => [name, inherited[name] as string])
      );
  env.HOME = privateHome;
  env.XDG_CONFIG_HOME = join(privateHome, 'config');
  env.XDG_DATA_HOME = join(privateHome, 'data');
  env.EVIDENCE_RUN_STATE_DIR = stateDir;
  env.EVIDENCE_WORKSPACE_ROOT = workspaceRoot;
  const runnerVariable =
    command === 'measure'
      ? 'EVIDENCE_MEASUREMENT_RUNNER_MODULE'
      : command === 'prepare'
        ? undefined
        : 'EVIDENCE_MUTATION_RUNNER_MODULE';
  if (runnerVariable && inherited[runnerVariable])
    env[runnerVariable] = inherited[runnerVariable];
  try {
    return await spawner.spawn(
      pinnedTsx(workspaceRoot),
      [
        absoluteToolPath(workspaceRoot, command),
        ...argumentsFor(command, runId, prepareInput),
      ],
      {
        cwd: workspaceRoot,
        env,
      }
    );
  } finally {
    await rm(privateHome, { recursive: true, force: true });
  }
}
