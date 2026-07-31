import {
  type EvidenceRunInput,
  openEvidenceRun,
} from './cloudflare-evidence-run-journal';

export function parseQualificationArguments(args: readonly string[]) {
  if (args.length !== 1 || args[0] !== '--prepare')
    throw new Error(
      'qualification is credentialless and accepts only --prepare'
    );
  return { mode: 'prepare' as const };
}

/** Creates the journal only; this command never receives a Cloudflare credential. */
export async function prepareCloudflareEvidenceRun(
  stateDir: string,
  input: EvidenceRunInput
) {
  const journal = await openEvidenceRun(stateDir, input);
  return { runId: journal.runId, nextPhase: 'mutate' as const };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  parseQualificationArguments(process.argv.slice(2));
  throw new Error(
    'prepare requires an approved journal input from the operator runbook'
  );
}
