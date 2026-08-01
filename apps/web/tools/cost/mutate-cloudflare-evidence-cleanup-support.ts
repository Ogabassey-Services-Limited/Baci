import type { TokenRevocationClient } from './cloudflare-evidence-run-journal';
import {
  type loadEvidenceRunForCleanup,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import type {
  EvidenceMutationClient,
  EvidenceReadbackClient,
  EvidenceResource,
} from './mutate-cloudflare-evidence-support';
import { verifyResource } from './mutate-cloudflare-evidence-support';

type EvidenceJournal = Awaited<ReturnType<typeof loadEvidenceRunForCleanup>>;

export async function verifyInventoryBeforeMutation(
  client: EvidenceMutationClient,
  journal: EvidenceJournal,
  resource: EvidenceResource | null
) {
  const observed = resource
    ? await client.inventorySha256(resource)
    : await client.inventorySha256();
  if (observed !== journal.preInventorySha256)
    throw new Error('provider inventory drift before mutation');
}

export async function verifyInventoryBeforeCleanup(
  client: EvidenceMutationClient,
  journal: EvidenceJournal,
  mutations: ReadonlyMap<string, string>
) {
  const resources: EvidenceResource[] = [];
  for (const [name, id] of mutations) {
    const resource = await client.get(id);
    if (resource) {
      verifyResource(resource, journal, name, id);
      resources.push(resource);
    }
  }
  let observed: string;
  if (resources.length === 0) observed = await client.inventorySha256();
  else if (resources.length === 1)
    observed = await client.inventorySha256(resources[0]);
  else if (client.inventorySha256Excluding)
    observed = await client.inventorySha256Excluding(resources);
  else throw new Error('cannot verify inventory before multi-resource cleanup');
  if (observed !== journal.preInventorySha256)
    throw new Error('provider inventory drift before cleanup');
}

export function requireTokenRevocationClient(
  client: EvidenceMutationClient
): TokenRevocationClient {
  if (
    typeof client.revoke !== 'function' ||
    typeof client.readBack !== 'function'
  )
    throw new Error('replacement cleanup token requires revocation readback');
  return { revoke: client.revoke, readBack: client.readBack };
}

export function requireTokenReadBackClient(
  client: EvidenceMutationClient | EvidenceReadbackClient
): Pick<TokenRevocationClient, 'readBack'> {
  if (typeof client.readBack !== 'function')
    throw new Error(
      'write-token receipt requires provider revocation readback'
    );
  return { readBack: client.readBack };
}

export async function revokeCleanupWriteTokenIfNeeded(
  stateDir: string,
  runId: string,
  cleanupTokenPresent: string | undefined,
  client: EvidenceMutationClient
) {
  if (!cleanupTokenPresent) return;
  await revokeEvidenceRunToken(
    stateDir,
    runId,
    'cleanup_write',
    requireTokenRevocationClient(client)
  );
}

export async function revokeWriteTokenIfAvailable(
  stateDir: string,
  runId: string,
  client: EvidenceMutationClient
) {
  if (
    typeof client.revoke !== 'function' ||
    typeof client.readBack !== 'function'
  )
    return false;
  await revokeEvidenceRunToken(stateDir, runId, 'write', {
    revoke: client.revoke,
    readBack: client.readBack,
  });
  return true;
}
