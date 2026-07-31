import { buildClosedEvidenceProcessEnvironment } from './qualify-cloudflare-evidence-sources';

export type EvidenceChildCommand = 'prepare' | 'mutate' | 'cleanup' | 'measure';
export type EvidenceProcessSpawner = Readonly<{
  spawn(
    executable: string,
    argv: readonly string[],
    options: Readonly<{ env: Record<string, string> }>
  ): Promise<void>;
}>;
type Credential = Readonly<{
  name: 'CLOUDFLARE_WRITE_TOKEN' | 'CLOUDFLARE_READ_TOKEN';
  value: string;
}>;

const argumentsFor = (command: EvidenceChildCommand, runId: string) => {
  if (command === 'prepare') return ['--prepare'];
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

/** Spawns exactly one purpose-bound command with a closed environment and one credential. */
export async function spawnIsolatedCloudflareEvidenceProcess(
  spawner: EvidenceProcessSpawner,
  command: EvidenceChildCommand,
  runId: string,
  inherited: Readonly<Record<string, string | undefined>>,
  credential?: Credential
) {
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
  const env = credential
    ? buildClosedEvidenceProcessEnvironment(
        credential.name,
        credential.value,
        inherited
      )
    : Object.fromEntries(
        ['PATH', 'HOME', 'TMPDIR']
          .filter((name) => inherited[name])
          .map((name) => [name, inherited[name] as string])
      );
  return await spawner.spawn(
    process.execPath,
    [scriptFor(command), ...argumentsFor(command, runId)],
    {
      env,
    }
  );
}
