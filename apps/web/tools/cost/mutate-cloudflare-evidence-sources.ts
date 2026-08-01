import type {
  TokenRevocationClient,
  TokenRevocationReceipt,
} from './cloudflare-evidence-run-journal';
import {
  loadEvidenceRunForCleanup,
  recordCleanupVerified,
  recordCleanupWriteToken,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordEvidenceProbeResults,
  recordTokenRevocation,
} from './cloudflare-evidence-run-journal';
import {
  requireTokenReadBackClient,
  revokeCleanupWriteTokenIfNeeded,
  revokeWriteTokenIfAvailable,
  verifyInventoryBeforeCleanup,
  verifyInventoryBeforeMutation,
} from './mutate-cloudflare-evidence-cleanup-support';
import type {
  EvidenceMutationClient,
  EvidenceMutationDependencies,
  EvidenceResource,
} from './mutate-cloudflare-evidence-support';
import {
  EVIDENCE_HOSTNAME,
  isEvidenceMutationClient,
  loadMutationDependencies,
  parseMutationArguments,
  SYNTHETIC_PATHS,
  verifyCapability,
  verifyIdentity,
  verifyResource,
} from './mutate-cloudflare-evidence-support';
import type { VerifiedEvidenceTokenCapability } from './verify-cloudflare-evidence-token-policy';

export type {
  EvidenceMutationClient,
  EvidenceMutationDependencies,
  EvidenceResource,
};
export { parseMutationArguments, SYNTHETIC_PATHS };

export function runMutationCommand(
  args: readonly string[],
  stateDir: string,
  dependencies: EvidenceMutationDependencies
) {
  const parsed = parseMutationArguments(args);
  if (parsed.mode === 'record_write_revocation') {
    if (!dependencies.revocationReceipt)
      throw new Error('an externally verified write-token receipt is required');
    return recordCloudflareEvidenceWriteTokenRevocation(
      stateDir,
      parsed.runId,
      dependencies.revocationReceipt,
      requireTokenReadBackClient(dependencies.client)
    );
  }
  if (!dependencies.capability)
    throw new Error('a verified write capability is required');
  if (!isEvidenceMutationClient(dependencies.client))
    throw new Error('mutation provider dependencies are invalid');
  return parsed.mode === 'apply'
    ? applyCloudflareEvidenceMutation(
        stateDir,
        parsed.runId,
        dependencies.capability,
        dependencies.client
      )
    : cleanupCloudflareEvidenceRun(
        stateDir,
        parsed.runId,
        dependencies.capability,
        dependencies.client
      );
}

/** Applies one deterministic resource set, recording every successful create before probing. */
export async function applyCloudflareEvidenceMutation(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceTokenCapability,
  client: EvidenceMutationClient
) {
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  verifyCapability(capability, journal, 'apply');
  if (!['prepared', 'mutated'].includes(journal.phase))
    throw new Error('mutation cannot run after cleanup or a terminal phase');
  verifyIdentity(await client.identity(), journal);
  const name = `baci-evidence-${runId}`;
  if (!journal.plannedResources.includes(name))
    throw new Error('deterministic resource was not pre-journaled');
  let resource = await client.findByName(name);
  await verifyInventoryBeforeMutation(client, journal, resource);
  if (resource) {
    const journaledResourceId = journal.mutations[name];
    if (!journaledResourceId)
      throw new Error('pre-existing resource collision');
    verifyResource(resource, journal, name, journaledResourceId);
  } else {
    const created = await client.create(
      name,
      EVIDENCE_HOSTNAME,
      SYNTHETIC_PATHS
    );
    resource = await client.get(created.id);
    if (!resource) throw new Error('created resource was not readable');
    verifyResource(resource, journal, name, created.id);
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
  const journal = await loadEvidenceRunForCleanup(stateDir, runId);
  verifyCapability(capability, journal, 'cleanup');
  verifyIdentity(await client.identity(), journal);
  if (
    ![
      'prepared',
      'mutated',
      'cleanup_verified',
      'cleanup_incomplete_stop',
    ].includes(journal.phase)
  )
    throw new Error(
      'cleanup cannot run after verification or a terminal phase'
    );
  const replacement = capability.tokenId !== journal.writeTokenId;
  if (replacement)
    await recordCleanupWriteToken(stateDir, runId, capability.tokenId);
  const journalAfterToken = replacement
    ? await loadEvidenceRunForCleanup(stateDir, runId)
    : journal;
  const cleanupTokenToRevoke =
    journalAfterToken.cleanupWriteTokenId &&
    !journalAfterToken.cleanupWriteTokenRevocationReceipt
      ? journalAfterToken.cleanupWriteTokenId
      : undefined;

  // Cleanup verification is durable before token revocation. If the process
  // dies in that gap, resume from the receipt without repeating deletes or
  // requiring the provider to recreate the already-verified state.
  if (journal.phase === 'cleanup_verified') {
    if (cleanupTokenToRevoke) {
      await revokeCleanupWriteTokenIfNeeded(
        stateDir,
        runId,
        cleanupTokenToRevoke,
        client
      );
    }
    if (
      !replacement &&
      (await revokeWriteTokenIfAvailable(stateDir, runId, client))
    )
      return loadEvidenceRunForCleanup(stateDir, runId);
    return loadEvidenceRunForCleanup(stateDir, runId);
  }
  const incomplete = journal.probeResults.length !== journal.expectedProbeCount;

  // A provider create may succeed between the API response and the journal
  // append. Discover only the deterministic pre-journaled names, bind the
  // returned ID, and then delete it; never search by a caller-selected ID.
  const mutations = new Map(Object.entries(journal.mutations));
  for (const name of journal.plannedResources) {
    if (mutations.has(name)) continue;
    const recovered = await client.findByName(name);
    if (!recovered) continue;
    verifyResource(recovered, journal, name);
    await recordEvidenceMutation(stateDir, runId, name, recovered.id);
    mutations.set(name, recovered.id);
  }

  await verifyInventoryBeforeCleanup(client, journal, mutations);
  for (const [name, id] of [...mutations.entries()].reverse()) {
    if (!journal.plannedResources.includes(name))
      throw new Error('journal mutation name is not planned');
    const resource = await client.get(id);
    if (!resource) continue;
    verifyResource(resource, journal, name, id);
    if (!(await client.cleanup(name, id)))
      throw new Error('evidence cleanup read-back did not prove absence');
    if (await client.get(id))
      throw new Error('evidence cleanup read-back did not prove absence');
  }
  if ((await client.inventorySha256()) !== journal.preInventorySha256)
    throw new Error('provider inventory drift after cleanup');
  const next = await recordEvidencePhase(
    stateDir,
    runId,
    incomplete ? 'cleanup_incomplete_stop' : 'mutated',
    {
      cleanupAttempts: journal.cleanupAttempts + 1,
      cleanupIncomplete: incomplete,
      readBackEvidence: [
        ...journal.readBackEvidence,
        'synthetic resources absent',
        ...(incomplete ? ['synthetic probe evidence incomplete; STOP'] : []),
      ],
    }
  );
  if (incomplete) {
    if (cleanupTokenToRevoke) {
      await revokeCleanupWriteTokenIfNeeded(
        stateDir,
        runId,
        cleanupTokenToRevoke,
        client
      );
    }
    if (
      !replacement &&
      (await revokeWriteTokenIfAvailable(stateDir, runId, client))
    )
      return loadEvidenceRunForCleanup(stateDir, runId);
    return cleanupTokenToRevoke
      ? loadEvidenceRunForCleanup(stateDir, runId)
      : next;
  }
  if (!client.verifyCleanup)
    throw new Error('cleanup verification requires provider readback');
  const verified = await recordCleanupVerified(stateDir, runId, client);
  if (cleanupTokenToRevoke) {
    await revokeCleanupWriteTokenIfNeeded(
      stateDir,
      runId,
      cleanupTokenToRevoke,
      client
    );
  }
  if (
    !replacement &&
    (await revokeWriteTokenIfAvailable(stateDir, runId, client))
  )
    return loadEvidenceRunForCleanup(stateDir, runId);
  if (cleanupTokenToRevoke) return loadEvidenceRunForCleanup(stateDir, runId);
  return verified;
}

/** Persists a provider/audit-verified write-token revocation after operator cleanup. */
export function recordCloudflareEvidenceWriteTokenRevocation(
  stateDir: string,
  runId: string,
  receipt: TokenRevocationReceipt,
  client: Pick<TokenRevocationClient, 'readBack'>
) {
  return recordTokenRevocation(stateDir, runId, 'write', receipt, client);
}

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], 'file:').href
) {
  const args = process.argv.slice(2);
  const parsed = parseMutationArguments(args);
  const stateDir = process.env.EVIDENCE_RUN_STATE_DIR;
  if (!stateDir) {
    process.stderr.write('absolute EVIDENCE_RUN_STATE_DIR is required\n');
    process.exitCode = 1;
  } else {
    loadMutationDependencies(parsed.runId, stateDir, parsed.mode)
      .then((dependencies) => runMutationCommand(args, stateDir, dependencies))
      .then((journal) =>
        process.stdout.write(
          `${JSON.stringify({ runId: journal.runId, phase: journal.phase })}\n`
        )
      )
      .catch((error: unknown) => {
        process.stderr.write(
          `${error instanceof Error ? error.message : 'mutation failed'}\n`
        );
        process.exitCode = 1;
      });
  }
}
