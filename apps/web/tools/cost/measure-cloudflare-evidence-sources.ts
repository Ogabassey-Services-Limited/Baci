import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  loadEvidenceRunForCleanup,
  RUN_ID_PATTERN,
  recordEvidenceMeasurement,
  recordEvidencePhase,
  revokeEvidenceRunToken,
  type TokenRevocationClient,
} from './cloudflare-evidence-run-journal';
import {
  verifyReviewedEvidenceFile,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';
import { assertMeasurementObservationWindow } from './measurement-observation-window';
import type { VerifiedEvidenceReadCapability } from './verify-cloudflare-evidence-read-token-policy';

export type EvidenceMeasurementClient = TokenRevocationClient & {
  measure(runId: string): Promise<{
    complete: boolean;
    expectedProbeCount: number;
    observedProbeCount: number;
    providerReceiptSha256: string;
    observedAt: string;
  }>;
};
export type EvidenceMeasurementDependencies = Readonly<{
  capability: VerifiedEvidenceReadCapability;
  client: EvidenceMeasurementClient;
}>;
type MeasurementCommand = Readonly<{
  mode: 'measure' | 'revoke-read';
  runId: string;
}>;
type MeasurementOptions = Readonly<{ now?: Date }>;
export function parseMeasurementArguments(args: readonly string[]) {
  if (
    args.length !== 2 ||
    !['--run', '--revoke-read'].includes(args[0]) ||
    !args[1] ||
    !RUN_ID_PATTERN.test(args[1])
  )
    throw new Error(
      'measurement is read-only and accepts only --run <runId> or --revoke-read <runId>'
    );
  return {
    mode:
      args[0] === '--revoke-read'
        ? ('revoke-read' as const)
        : ('measure' as const),
    runId: args[1],
  } satisfies MeasurementCommand;
}
export function runMeasurementCommand(
  args: readonly string[],
  stateDir: string,
  dependencies: EvidenceMeasurementDependencies
) {
  const parsed = parseMeasurementArguments(args);
  return parsed.mode === 'revoke-read'
    ? revokeCloudflareEvidenceReadToken(
        stateDir,
        parsed.runId,
        dependencies.capability,
        dependencies.client
      )
    : measureCloudflareEvidenceSources(
        stateDir,
        parsed.runId,
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
type MeasurementDependencyLoader = (
  runId: string,
  stateDir: string
) => Promise<EvidenceMeasurementDependencies>;
async function loadMeasurementDependencies(runId: string, stateDir: string) {
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  const workspaceRoot = process.env.EVIDENCE_WORKSPACE_ROOT;
  if (!workspaceRoot)
    throw new Error('absolute EVIDENCE_WORKSPACE_ROOT is required');
  const commandPath = resolve(
    workspaceRoot,
    'apps/web/tools/cost/measure-cloudflare-evidence-sources.ts'
  );
  if (!process.argv[1] || resolve(process.argv[1]) !== commandPath)
    throw new Error('measurement command entrypoint is not reviewed');
  await verifyReviewedEvidenceFile(
    workspaceRoot,
    journal.toolingMergeSha,
    commandPath
  );
  const configuredPath = process.env.EVIDENCE_MEASUREMENT_RUNNER_MODULE;
  const configuredSha256 =
    process.env.EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256;
  const modulePath = journal.measurementRunnerModulePath;
  const token = process.env.CLOUDFLARE_READ_TOKEN;
  if (!modulePath || !journal.measurementRunnerModuleSha256)
    throw new Error(
      'measurement runner module descriptor is missing from the journal'
    );
  if (configuredPath && resolve(configuredPath) !== resolve(modulePath))
    throw new Error('measurement runner module does not match the journal');
  if (
    configuredSha256 &&
    configuredSha256 !== journal.measurementRunnerModuleSha256
  )
    throw new Error(
      'measurement runner module hash does not match the journal'
    );
  if (!token)
    throw new Error(
      'measurement requires a provider runner module and the isolated read token'
    );
  const verified = await verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    journal.toolingMergeSha,
    { path: modulePath, sha256: journal.measurementRunnerModuleSha256 }
  );
  const bytes = await readFile(verified.path);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== verified.sha256)
    throw new Error(
      'measurement runner module hash does not match the journal'
    );
  const loaded: unknown = await import(pathToFileURL(verified.path).href);
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
/** Keeps argument parsing inside the same rejection path as dependency loading. */
export function runMeasurementEntrypoint(
  args: readonly string[],
  stateDir: string,
  loadDependencies: MeasurementDependencyLoader = loadMeasurementDependencies
) {
  return Promise.resolve()
    .then(() => parseMeasurementArguments(args))
    .then((parsed) => loadDependencies(parsed.runId, stateDir))
    .then((dependencies) =>
      runMeasurementCommand(args, stateDir, dependencies)
    );
}
/** Polls only after the journal proves write cleanup and revocation; it accepts no write credential. */
export async function measureCloudflareEvidenceSources(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceReadCapability,
  client: EvidenceMeasurementClient,
  options: MeasurementOptions = {}
) {
  if (capability.kind !== 'read')
    throw new Error('a verified read capability is required');
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  assertReadCapabilityMatchesJournal(capability, journal);
  const measurementAlreadyRecorded = Boolean(
    journal.measurementVerifiedAt && journal.measurementReceiptSha256
  );
  if (
    !['write_token_revoked', 'read_token_revoked'].includes(journal.phase) ||
    (journal.phase === 'read_token_revoked' && !measurementAlreadyRecorded) ||
    !journal.writeTokenRevocationReceipt ||
    journal.writeTokenRevocationReceipt.tokenId !== journal.writeTokenId ||
    !journal.cleanupVerifiedAt ||
    !journal.cleanupVerificationReceiptSha256 ||
    journal.cleanupIncomplete ||
    Object.keys(journal.mutations).length === 0 ||
    journal.probeResults.length !== journal.expectedProbeCount
  )
    throw new Error(
      'write process must exit, clean up, and revoke before measurement'
    );
  // Measurement is append-only and may already be durable when a read-token
  // revoke or the final phase write failed. Resume from that receipt instead
  // of polling the provider again and risking a conflicting receipt.
  if (measurementAlreadyRecorded) {
    assertMeasurementObservationWindow(
      journal,
      journal.measurementVerifiedAt,
      options.now ?? new Date()
    );
    if (journal.phase === 'read_token_revoked')
      return recordEvidencePhase(stateDir, runId, 'proof_complete');
    await revokeEvidenceRunToken(stateDir, runId, 'read', client);
    return recordEvidencePhase(stateDir, runId, 'proof_complete');
  }
  const result = await client.measure(runId);
  if (
    !result.complete ||
    result.expectedProbeCount !== journal.expectedProbeCount ||
    result.observedProbeCount !== journal.expectedProbeCount ||
    result.expectedProbeCount !== result.observedProbeCount
  )
    throw new Error('Cloudflare evidence export is incomplete');
  if (
    !/^[a-f0-9]{64}$/.test(result.providerReceiptSha256) ||
    Number.isNaN(new Date(result.observedAt).valueOf())
  )
    throw new Error('Cloudflare evidence export receipt is invalid');
  assertMeasurementObservationWindow(
    journal,
    result.observedAt,
    options.now ?? new Date()
  );
  await recordEvidenceMeasurement(stateDir, runId, {
    providerReceiptSha256: result.providerReceiptSha256,
    observedAt: result.observedAt,
  });
  await revokeEvidenceRunToken(stateDir, runId, 'read', client);
  return recordEvidencePhase(stateDir, runId, 'proof_complete');
}
/** Revokes the read token after an incomplete cleanup without polling or recording proof. */
export async function revokeCloudflareEvidenceReadToken(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceReadCapability,
  client: EvidenceMeasurementClient
) {
  if (capability.kind !== 'read')
    throw new Error('a verified read capability is required');
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  assertReadCapabilityMatchesJournal(capability, journal);
  if (
    journal.phase !== 'write_token_revoked' ||
    !journal.cleanupIncomplete ||
    !journal.writeTokenRevocationReceipt ||
    journal.writeTokenRevocationReceipt.tokenId !== journal.writeTokenId ||
    journal.measurementVerifiedAt ||
    journal.measurementReceiptSha256
  )
    throw new Error(
      'read-token revocation requires a write-revoked incomplete cleanup run'
    );
  return revokeEvidenceRunToken(stateDir, runId, 'read', client);
}
function assertReadCapabilityMatchesJournal(
  capability: VerifiedEvidenceReadCapability,
  journal: Awaited<ReturnType<typeof loadEvidenceRunForCleanup>>
) {
  if (
    capability.tokenId !== journal.readTokenId ||
    capability.accountId !== journal.accountId ||
    capability.zoneId !== journal.zoneId ||
    !journal.readPolicySha256 ||
    capability.policySha256 !== journal.readPolicySha256
  )
    throw new Error('read capability does not match the journaled authority');
}
if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  const args = process.argv.slice(2);
  const stateDir = process.env.EVIDENCE_RUN_STATE_DIR;
  if (!stateDir) {
    process.stderr.write('absolute EVIDENCE_RUN_STATE_DIR is required\n');
    process.exitCode = 1;
  } else {
    runMeasurementEntrypoint(args, stateDir)
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
