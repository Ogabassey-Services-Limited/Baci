import {
  loadEvidenceRunForCleanup,
  RUN_ID_PATTERN,
  recordEvidenceMeasurement,
  recordEvidenceMeasurementFailure,
  recordEvidencePhase,
  revokeEvidenceRunToken,
  type TokenRevocationClient,
} from './cloudflare-evidence-run-journal';
import { loadMeasurementDependencies } from './measure-cloudflare-evidence-sources-loader';
import { hasVerifiedCleanupWriteTokenRevocation } from './measure-cloudflare-evidence-sources-requirements';
import { assertMeasurementObservationWindow } from './measurement-observation-window';
import type { VerifiedEvidenceReadCapability } from './verify-cloudflare-evidence-read-token-policy';
export type EvidenceMeasurementClient = TokenRevocationClient & {
  measure(runId: string): Promise<{
    complete: boolean;
    expectedProbeCount: number;
    observedProbeCount: number;
    probeResults: readonly string[];
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
type MeasurementDependencyLoader = (
  runId: string,
  stateDir: string
) => Promise<EvidenceMeasurementDependencies>;
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
  if (journal.measurementIncomplete)
    throw new Error(
      'measurement evidence is terminal; use --revoke-read to close the run'
    );
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
    journal.probeResults.length !== journal.expectedProbeCount ||
    !hasVerifiedCleanupWriteTokenRevocation(journal)
  )
    throw new Error(
      'write process must exit, clean up, and revoke before measurement'
    );
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
  try {
    const result = await client.measure(runId);
    if (
      !result.complete ||
      result.expectedProbeCount !== journal.expectedProbeCount ||
      result.observedProbeCount !== journal.expectedProbeCount ||
      result.expectedProbeCount !== result.observedProbeCount ||
      !Array.isArray(result.probeResults) ||
      result.probeResults.length !== journal.probeResults.length ||
      new Set(result.probeResults).size !== result.probeResults.length ||
      result.probeResults.some((probe) => !journal.probeResults.includes(probe))
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
  } catch (error) {
    try {
      await recordEvidenceMeasurementFailure(stateDir, runId);
    } catch (markError) {
      throw new AggregateError(
        [error, markError],
        'measurement failed and could not be durably marked'
      );
    }
    throw error;
  }
  await revokeEvidenceRunToken(stateDir, runId, 'read', client);
  return recordEvidencePhase(stateDir, runId, 'proof_complete');
}
export async function revokeCloudflareEvidenceReadToken(
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
  const staleMeasurement =
    measurementAlreadyRecorded &&
    isMeasurementOutsideWindow(journal, options.now ?? new Date());
  if (
    !['write_token_revoked', 'read_token_revoked'].includes(journal.phase) ||
    (!journal.cleanupIncomplete &&
      !journal.measurementIncomplete &&
      !measurementAlreadyRecorded) ||
    !journal.writeTokenRevocationReceipt ||
    journal.writeTokenRevocationReceipt.tokenId !== journal.writeTokenId ||
    !hasVerifiedCleanupWriteTokenRevocation(journal)
  )
    throw new Error(
      'read-token revocation requires a write-revoked incomplete run'
    );
  if (journal.phase === 'read_token_revoked') {
    if (!staleMeasurement)
      throw new Error(
        'read token is already revoked; normal measurement completion is required'
      );
    return recordEvidencePhase(stateDir, runId, 'closed_stop', {
      measurementIncomplete: true,
      readBackEvidence: appendMeasurementStopEvidence(journal.readBackEvidence),
    });
  }
  const revoked = await revokeEvidenceRunToken(stateDir, runId, 'read', client);
  if (!staleMeasurement) return revoked;
  return recordEvidencePhase(stateDir, runId, 'closed_stop', {
    measurementIncomplete: true,
    readBackEvidence: appendMeasurementStopEvidence(journal.readBackEvidence),
  });
}
function isMeasurementOutsideWindow(
  journal: Awaited<ReturnType<typeof loadEvidenceRunForCleanup>>,
  now: Date
) {
  try {
    assertMeasurementObservationWindow(
      journal,
      journal.measurementVerifiedAt,
      now
    );
    return false;
  } catch {
    return true;
  }
}
function appendMeasurementStopEvidence(evidence: readonly string[]) {
  const marker = 'measurement evidence outside active run window; STOP';
  return evidence.includes(marker) ? evidence : [...evidence, marker];
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
