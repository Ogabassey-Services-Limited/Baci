import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  loadEvidenceRunForCleanup,
  recordEvidencePhase,
  revokeEvidenceRunToken,
  type TokenRevocationClient,
} from './cloudflare-evidence-run-journal';
import type { VerifiedEvidenceReadCapability } from './verify-cloudflare-evidence-read-token-policy';

export type EvidenceMeasurementClient = TokenRevocationClient & {
  measure(runId: string): Promise<{
    complete: boolean;
    expectedProbeCount: number;
    observedProbeCount: number;
  }>;
};
export type EvidenceMeasurementDependencies = Readonly<{
  capability: VerifiedEvidenceReadCapability;
  client: EvidenceMeasurementClient;
}>;
export function parseMeasurementArguments(args: readonly string[]) {
  if (args.length !== 2 || args[0] !== '--run' || !args[1])
    throw new Error('measurement is read-only and accepts only --run <runId>');
  return { runId: args[1] };
}

export function runMeasurementCommand(
  args: readonly string[],
  stateDir: string,
  dependencies: EvidenceMeasurementDependencies
) {
  const { runId } = parseMeasurementArguments(args);
  return measureCloudflareEvidenceSources(
    stateDir,
    runId,
    dependencies.capability,
    dependencies.client
  );
}

type MeasurementRunnerFactory = (
  input: Readonly<{
    token: string;
    runId: string;
    stateDir: string;
  }>
) => Promise<EvidenceMeasurementDependencies>;

async function loadMeasurementDependencies(runId: string, stateDir: string) {
  const modulePath = process.env.EVIDENCE_MEASUREMENT_RUNNER_MODULE;
  const token = process.env.CLOUDFLARE_READ_TOKEN;
  if (!modulePath || !token)
    throw new Error(
      'measurement requires a provider runner module and the isolated read token'
    );
  const loaded: unknown = await import(pathToFileURL(resolve(modulePath)).href);
  const factory =
    loaded &&
    typeof loaded === 'object' &&
    'createMeasurementDependencies' in loaded
      ? (loaded as { createMeasurementDependencies?: unknown })
          .createMeasurementDependencies
      : undefined;
  if (typeof factory !== 'function')
    throw new Error('measurement runner module is invalid');
  return (factory as MeasurementRunnerFactory)({ token, runId, stateDir });
}

/** Polls only after the journal proves write cleanup and revocation; it accepts no write credential. */
export async function measureCloudflareEvidenceSources(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceReadCapability,
  client: EvidenceMeasurementClient
) {
  if (capability.kind !== 'read')
    throw new Error('a verified read capability is required');
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  if (
    journal.phase !== 'write_token_revoked' ||
    !journal.writeTokenRevocationReceipt ||
    journal.writeTokenRevocationReceipt.tokenId !== journal.writeTokenId ||
    !journal.cleanupVerifiedAt ||
    journal.cleanupVerificationReceiptSha256 !== journal.preInventorySha256
  )
    throw new Error(
      'write process must exit, clean up, and revoke before measurement'
    );
  const result = await client.measure(runId);
  if (
    !result.complete ||
    result.expectedProbeCount !== journal.expectedProbeCount ||
    result.observedProbeCount !== journal.expectedProbeCount
  )
    throw new Error('Cloudflare evidence export is incomplete');
  await revokeEvidenceRunToken(stateDir, runId, 'read', client);
  return recordEvidencePhase(stateDir, runId, 'proof_complete');
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  const args = process.argv.slice(2);
  const parsed = parseMeasurementArguments(args);
  const stateDir = process.env.EVIDENCE_RUN_STATE_DIR;
  if (!stateDir) {
    process.stderr.write('absolute EVIDENCE_RUN_STATE_DIR is required\n');
    process.exitCode = 1;
  } else {
    loadMeasurementDependencies(parsed.runId, stateDir)
      .then((dependencies) =>
        runMeasurementCommand(args, stateDir, dependencies)
      )
      .then((journal) =>
        process.stdout.write(
          `${JSON.stringify({ runId: journal.runId, phase: journal.phase })}\n`
        )
      )
      .catch((error: unknown) => {
        process.stderr.write(
          `${error instanceof Error ? error.message : 'measurement failed'}\n`
        );
        process.exitCode = 1;
      });
  }
}
