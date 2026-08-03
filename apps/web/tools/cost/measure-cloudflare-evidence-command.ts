import { RUN_ID_PATTERN } from './cloudflare-evidence-run-journal';
import {
  type EvidenceReadRevocationDependencies,
  recordCloudflareEvidenceReadTokenRevocation,
} from './measure-cloudflare-evidence-read-revocation';
import type { EvidenceMeasurementDependencies } from './measure-cloudflare-evidence-sources';
import { measureCloudflareEvidenceSources } from './measure-cloudflare-evidence-sources';
import { loadMeasurementDependencies } from './measure-cloudflare-evidence-sources-loader';

export type MeasurementCommand = Readonly<{
  mode: 'measure' | 'record-read-revocation';
  runId: string;
}>;
type MeasurementDependencyLoader = (
  runId: string,
  stateDir: string,
  mode?: 'measure' | 'record-read-revocation'
) => Promise<
  EvidenceMeasurementDependencies | EvidenceReadRevocationDependencies
>;

export function parseMeasurementArguments(args: readonly string[]) {
  if (
    args.length !== 2 ||
    !['--run', '--record-read-revocation'].includes(args[0]) ||
    !args[1] ||
    !RUN_ID_PATTERN.test(args[1])
  )
    throw new Error(
      'measurement is read-only and accepts only --run <runId> or --record-read-revocation <runId>'
    );
  return {
    mode:
      args[0] === '--record-read-revocation'
        ? ('record-read-revocation' as const)
        : ('measure' as const),
    runId: args[1],
  } satisfies MeasurementCommand;
}

export function runMeasurementCommand(
  args: readonly string[],
  stateDir: string,
  dependencies:
    | EvidenceMeasurementDependencies
    | EvidenceReadRevocationDependencies
) {
  const parsed = parseMeasurementArguments(args);
  if (parsed.mode === 'record-read-revocation') {
    if (!('revocationReceipt' in dependencies))
      throw new Error('an externally verified read-token receipt is required');
    return recordCloudflareEvidenceReadTokenRevocation(
      stateDir,
      parsed.runId,
      dependencies
    );
  }
  if (!('capability' in dependencies))
    throw new Error('a verified read capability is required');
  return measureCloudflareEvidenceSources(
    stateDir,
    parsed.runId,
    dependencies.capability,
    dependencies.client
  );
}

/** Keeps argument parsing inside the same rejection path as dependency loading. */
export function runMeasurementEntrypoint(
  args: readonly string[],
  stateDir: string,
  loadDependencies: MeasurementDependencyLoader = loadMeasurementDependencies
) {
  return Promise.resolve()
    .then(() => {
      if (process.env.CLOUDFLARE_WRITE_TOKEN !== undefined)
        throw new Error('measurement process inherited a write credential');
    })
    .then(() => parseMeasurementArguments(args))
    .then((parsed) =>
      loadDependencies(
        parsed.runId,
        stateDir,
        parsed.mode === 'record-read-revocation'
          ? 'record-read-revocation'
          : 'measure'
      )
    )
    .then((dependencies) =>
      runMeasurementCommand(args, stateDir, dependencies)
    );
}
