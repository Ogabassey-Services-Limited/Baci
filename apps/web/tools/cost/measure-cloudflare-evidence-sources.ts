import {
  loadEvidenceRunForCleanup,
  recordEvidenceMeasurement,
  recordEvidenceMeasurementFailure,
  recordEvidencePhase,
} from './cloudflare-evidence-run-journal';
import { runMeasurementEntrypoint } from './measure-cloudflare-evidence-command';
import { hasVerifiedCleanupWriteTokenRevocation } from './measure-cloudflare-evidence-sources-requirements';
import { assertMeasurementObservationWindow } from './measurement-observation-window';
import { REVIEWED_PROBE_CASE_IDS } from './mutate-cloudflare-evidence-probes';
import type { VerifiedEvidenceReadCapability } from './verify-cloudflare-evidence-read-token-policy';

export {
  parseMeasurementArguments,
  runMeasurementCommand,
  runMeasurementEntrypoint,
} from './measure-cloudflare-evidence-command';
export type EvidenceMeasurementClient = {
  measure(runId: string): Promise<{
    complete: boolean;
    expectedProbeCount: number;
    observedProbeCount: number;
    probeResults: readonly string[];
    providerReceiptSha256: string;
    payloadSha256: string;
    observedAt: string;
  }>;
};
export type EvidenceMeasurementDependencies = Readonly<{
  capability: VerifiedEvidenceReadCapability;
  client: EvidenceMeasurementClient;
}>;
type MeasurementOptions = Readonly<{ now?: Date }>;
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
      'measurement evidence is terminal; revoke the read token externally'
    );
  const measurementAlreadyRecorded = Boolean(
    journal.measurementVerifiedAt && journal.measurementReceiptSha256
  );
  if (
    ![
      'write_token_revoked',
      'measurement_complete_pending_read_revocation',
    ].includes(journal.phase) ||
    !journal.writeTokenRevocationReceipt ||
    journal.writeTokenRevocationReceipt.tokenId !== journal.writeTokenId ||
    !journal.cleanupVerifiedAt ||
    !journal.cleanupVerificationReceiptSha256 ||
    journal.cleanupIncomplete ||
    Object.keys(journal.mutations).length === 0 ||
    journal.expectedProbeCount !== REVIEWED_PROBE_CASE_IDS.length ||
    journal.probeResults.length !== REVIEWED_PROBE_CASE_IDS.length ||
    journal.probeResults.some(
      (probeId, index) => probeId !== REVIEWED_PROBE_CASE_IDS[index]
    ) ||
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
    if (journal.phase === 'write_token_revoked')
      return recordEvidencePhase(
        stateDir,
        runId,
        'measurement_complete_pending_read_revocation'
      );
    return journal;
  }
  try {
    const result = await client.measure(runId);
    if (
      !result.complete ||
      result.expectedProbeCount !== journal.expectedProbeCount ||
      result.observedProbeCount !== journal.expectedProbeCount ||
      result.expectedProbeCount !== result.observedProbeCount ||
      !Array.isArray(result.probeResults) ||
      result.probeResults.length !== REVIEWED_PROBE_CASE_IDS.length ||
      new Set(result.probeResults).size !== result.probeResults.length ||
      REVIEWED_PROBE_CASE_IDS.some(
        (probeId) => !result.probeResults.includes(probeId)
      )
    )
      throw new Error('Cloudflare evidence export is incomplete');
    if (
      !/^[a-f0-9]{64}$/.test(result.providerReceiptSha256) ||
      !/^[a-f0-9]{64}$/.test(result.payloadSha256) ||
      Number.isNaN(new Date(result.observedAt).valueOf())
    )
      throw new Error('Cloudflare evidence export receipt is invalid');
    assertMeasurementObservationWindow(
      journal,
      result.observedAt,
      options.now ?? new Date()
    );
    return await recordEvidenceMeasurement(stateDir, runId, {
      providerReceiptSha256: result.providerReceiptSha256,
      payloadSha256: result.payloadSha256,
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
