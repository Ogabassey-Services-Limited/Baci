import {
  loadEvidenceRunForCleanup,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordEvidenceProbeResults,
} from './cloudflare-evidence-run-journal';
import type { VerifiedEvidenceTokenCapability } from './verify-cloudflare-evidence-token-policy';

const EVIDENCE_HOSTNAME = 'edge-evidence.ogabassey.com';
const SYNTHETIC_PATHS = ['/baci-evidence/a', '/baci-evidence/b'] as const;
type EvidenceResource = Readonly<{
  id: string;
  name: string;
  description: string;
  accountId: string;
  zoneId: string;
}>;
type EvidenceProbeResult = Readonly<{ id: string; succeeded: boolean }>;
export type EvidenceMutationClient = {
  identity(): Promise<{ accountId: string; zoneId: string }>;
  findByName(name: string): Promise<EvidenceResource | null>;
  get(id: string): Promise<EvidenceResource | null>;
  create(
    name: string,
    hostname: string,
    paths: readonly string[]
  ): Promise<{ id: string }>;
  probe(resource: EvidenceResource): Promise<readonly EvidenceProbeResult[]>;
  cleanup(name: string, id: string): Promise<boolean>;
  inventorySha256(excluding?: EvidenceResource): Promise<string>;
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

function verifyCapability(capability: VerifiedEvidenceTokenCapability) {
  if (capability.kind !== 'write')
    throw new Error('a verified write capability is required');
}
function verifyIdentity(
  actual: { accountId: string; zoneId: string },
  expected: { accountId: string; zoneId: string }
) {
  if (actual.accountId !== expected.accountId)
    throw new Error('provider account does not match journal');
  if (actual.zoneId !== expected.zoneId)
    throw new Error('provider zone does not match journal');
}
function verifyResource(
  resource: EvidenceResource,
  journal: Awaited<ReturnType<typeof loadEvidenceRunForCleanup>>,
  name: string
) {
  if (
    resource.name !== name ||
    !resource.description.includes(journal.runId) ||
    resource.accountId !== journal.accountId ||
    resource.zoneId !== journal.zoneId
  )
    throw new Error(
      'journaled resource identity does not match provider read-back'
    );
}

/** Applies one deterministic resource set, recording every successful create before probing. */
export async function applyCloudflareEvidenceMutation(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceTokenCapability,
  client: EvidenceMutationClient
) {
  verifyCapability(capability);
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  verifyIdentity(await client.identity(), journal);
  const name = `baci-evidence-${runId}`;
  if (!journal.plannedResources.includes(name))
    throw new Error('deterministic resource was not pre-journaled');
  let resource = await client.findByName(name);
  if (
    (await client.inventorySha256(resource ?? undefined)) !==
    journal.preInventorySha256
  )
    throw new Error('provider inventory drift before mutation');
  if (resource) {
    if (!resource.description.includes(runId))
      throw new Error('pre-existing resource collision');
    verifyResource(resource, journal, name);
    if (!journal.mutations[name])
      await recordEvidenceMutation(stateDir, runId, name, resource.id);
  } else {
    const created = await client.create(
      name,
      EVIDENCE_HOSTNAME,
      SYNTHETIC_PATHS
    );
    resource = await client.get(created.id);
    if (!resource) throw new Error('created resource was not readable');
    verifyResource(resource, journal, name);
    await recordEvidenceMutation(stateDir, runId, name, resource.id);
  }
  const probes = await client.probe(resource);
  if (probes.some((probe) => !probe.succeeded))
    throw new Error('synthetic probe did not complete');
  await recordEvidenceProbeResults(
    stateDir,
    runId,
    probes.map((probe) => probe.id)
  );
  return cleanupCloudflareEvidenceRun(stateDir, runId, capability, client);
}

/** Cleanup mode never creates or probes; it deletes only exact journaled resources. */
export async function cleanupCloudflareEvidenceRun(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceTokenCapability,
  client: EvidenceMutationClient
) {
  verifyCapability(capability);
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  verifyIdentity(await client.identity(), journal);
  if (journal.probeResults.length !== journal.expectedProbeCount)
    throw new Error(
      'cleanup requires exactly the journaled bounded probe results'
    );
  for (const [name, id] of Object.entries(journal.mutations).reverse()) {
    if (!journal.plannedResources.includes(name))
      throw new Error('journal mutation name is not planned');
    const resource = await client.get(id);
    if (!resource) continue;
    verifyResource(resource, journal, name);
    if (!(await client.cleanup(name, id)))
      throw new Error('evidence cleanup read-back did not prove absence');
  }
  if ((await client.inventorySha256()) !== journal.preInventorySha256)
    throw new Error('provider inventory drift after cleanup');
  return recordEvidencePhase(stateDir, runId, 'cleanup_verified', {
    cleanupAttempts: journal.cleanupAttempts + 1,
    readBackEvidence: [
      ...journal.readBackEvidence,
      'synthetic resources absent',
    ],
  });
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
)
  parseMutationArguments(process.argv.slice(2));
