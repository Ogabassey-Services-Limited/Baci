import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal';
import type { EvidenceMutationDependencies } from './mutate-cloudflare-evidence-support';
import {
  loadMutationDependencies,
  parseMutationArguments,
} from './mutate-cloudflare-evidence-support';

type MutationCommand = (
  args: readonly string[],
  stateDir: string,
  dependencies: EvidenceMutationDependencies
) => Promise<CloudflareEvidenceRunJournal>;
type MutationCliIo = Readonly<{
  stdout: (value: string) => void;
  stderr: (value: string) => void;
  setExitCode: (code: number) => void;
}>;

export async function runMutationCli(
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  io: MutationCliIo,
  command: MutationCommand
) {
  try {
    if (environment.CLOUDFLARE_READ_TOKEN !== undefined)
      throw new Error('mutation process inherited a read credential');
    const parsed = parseMutationArguments(args);
    const stateDir = environment.EVIDENCE_RUN_STATE_DIR;
    if (!stateDir)
      throw new Error('absolute EVIDENCE_RUN_STATE_DIR is required');
    const journal = await loadMutationDependencies(
      parsed.runId,
      stateDir,
      parsed.mode
    ).then((dependencies) => command(args, stateDir, dependencies));
    io.stdout(
      `${JSON.stringify({ runId: journal.runId, phase: journal.phase })}\n`
    );
  } catch (error: unknown) {
    io.stderr(
      `${error instanceof Error ? error.message : 'mutation failed'}\n`
    );
    io.setExitCode(1);
  }
}

export function runMutationCliFromProcess(command: MutationCommand) {
  void runMutationCli(
    process.argv.slice(2),
    process.env,
    {
      stdout: (value) => process.stdout.write(value),
      stderr: (value) => process.stderr.write(value),
      setExitCode: (code) => {
        process.exitCode = code;
      },
    },
    command
  );
}
