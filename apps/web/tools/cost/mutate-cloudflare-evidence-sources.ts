import {
  recordEvidenceMutation,
  recordEvidencePhase,
} from './cloudflare-evidence-run-journal';
import type { VerifiedEvidenceTokenCapability } from './verify-cloudflare-evidence-token-policy';

const EVIDENCE_HOSTNAME = 'edge-evidence.ogabassey.com';
const SYNTHETIC_PATHS = ['/baci-evidence/a', '/baci-evidence/b'] as const;
export type EvidenceMutationClient = {
  create(
    name: string,
    hostname: string,
    paths: readonly string[]
  ): Promise<{ id: string }>;
  cleanup(name: string, id: string): Promise<boolean>;
};

export function parseMutationArguments(args: readonly string[]) {
  if (args.length === 2 && args[0] === '--cleanup-run' && args[1])
    return { mode: 'cleanup' as const, runId: args[1] };
  if (
    args.length !== 3 ||
    args[0] !== '--run' ||
    !args[1] ||
    args[2] !== '--apply'
  )
    throw new Error(
      'mutation accepts only --run <runId> --apply or --cleanup-run <runId>'
    );
  return { mode: 'apply' as const, runId: args[1] };
}

/** Mutates only one pre-journaled synthetic resource with a branded write capability. */
export async function applyCloudflareEvidenceMutation(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceTokenCapability,
  client: EvidenceMutationClient
) {
  if (capability.kind !== 'write')
    throw new Error('a verified write capability is required');
  const name = `baci-evidence-${runId}`;
  const created = await client.create(name, EVIDENCE_HOSTNAME, SYNTHETIC_PATHS);
  await recordEvidenceMutation(stateDir, runId, name, created.id);
  if (!(await client.cleanup(name, created.id)))
    throw new Error('evidence cleanup read-back did not prove absence');
  return recordEvidencePhase(stateDir, runId, 'cleanup_verified', {
    readBackEvidence: ['synthetic resource absent'],
  });
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
)
  parseMutationArguments(process.argv.slice(2));
