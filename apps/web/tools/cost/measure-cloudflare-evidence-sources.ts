import {
  loadEvidenceRunForCleanup,
  recordTokenRevocation,
  type TokenRevocationReceipt,
} from './cloudflare-evidence-run-journal';
import type { VerifiedEvidenceReadCapability } from './verify-cloudflare-evidence-read-token-policy';

export type EvidenceMeasurementClient = {
  measure(runId: string): Promise<{
    complete: boolean;
    expectedProbeCount: number;
    observedProbeCount: number;
  }>;
  verifyReadTokenRevocation(tokenId: string): Promise<TokenRevocationReceipt>;
};
export function parseMeasurementArguments(args: readonly string[]) {
  if (args.length !== 2 || args[0] !== '--run' || !args[1])
    throw new Error('measurement is read-only and accepts only --run <runId>');
  return { runId: args[1] };
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
    journal.writeTokenRevocationReceipt.tokenId !== journal.writeTokenId
  )
    throw new Error(
      'write process must exit, clean up, and revoke before measurement'
    );
  const result = await client.measure(runId);
  if (
    !result.complete ||
    result.expectedProbeCount !== result.observedProbeCount
  )
    throw new Error('Cloudflare evidence export is incomplete');
  const receipt = await client.verifyReadTokenRevocation(journal.readTokenId);
  return recordTokenRevocation(stateDir, runId, 'read', receipt);
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
)
  parseMeasurementArguments(process.argv.slice(2));
