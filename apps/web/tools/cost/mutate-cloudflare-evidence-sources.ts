import { withEvidenceRunOperationLock } from './cloudflare-evidence-operation-lock';
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
  reconcileCreatedEvidenceResource,
  revokeCleanupWriteTokenIfNeeded,
  revokeWriteTokenIfAvailable,
  verifyInventoryBeforeCleanup,
  verifyInventoryBeforeMutation,
} from './mutate-cloudflare-evidence-cleanup-support';
import { dispatchMutationCommand } from './mutate-cloudflare-evidence-command';
import { runMutationCliFromProcess } from './mutate-cloudflare-evidence-entrypoint';
import type {
  EvidenceMutationClient,
  EvidenceMutationDependencies,
  EvidenceResource,
} from './mutate-cloudflare-evidence-support';
import {
  EVIDENCE_HOSTNAME,
  parseMutationArguments,
  REVIEWED_TEMPORARY_RULE_BINDING,
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
  return dispatchMutationCommand(args, stateDir, dependencies, {
    apply: applyCloudflareEvidenceMutation,
    cleanup: cleanupCloudflareEvidenceRun,
    recordRevocation: recordCloudflareEvidenceWriteTokenRevocation,
  });
}
export function applyCloudflareEvidenceMutation(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceTokenCapability,
  client: EvidenceMutationClient
) {
  return withEvidenceRunOperationLock(stateDir, runId, () =>
    applyCloudflareEvidenceMutationUnlocked(stateDir, runId, capability, client)
  );
}
async function applyCloudflareEvidenceMutationUnlocked(
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
    let createdId: string | undefined;
    try {
      const created = await client.create(
        name,
        EVIDENCE_HOSTNAME,
        SYNTHETIC_PATHS,
        REVIEWED_TEMPORARY_RULE_BINDING
      );
      createdId = created.id;
      if (!createdId)
        throw new Error('provider create returned no resource ID');
      resource = await client.get(createdId);
      if (!resource) throw new Error('created resource was not readable');
      verifyResource(resource, journal, name, createdId);
      await recordEvidenceMutation(stateDir, runId, name, resource.id);
    } catch (error) {
      const failures: unknown[] = [error];
      try {
        await reconcileCreatedEvidenceResource(client, name, createdId);
      } catch (reconcileError) {
        failures.push(reconcileError);
      }
      try {
        await cleanupCloudflareEvidenceRunUnlocked(
          stateDir,
          runId,
          capability,
          client
        );
      } catch (cleanupError) {
        failures.push(cleanupError);
      }
      if (failures.length > 1)
        throw new AggregateError(
          failures,
          'created evidence resource cleanup did not complete'
        );
      throw error;
    }
  }
  try {
    const probes = await client.probe(resource);
    if (probes.some((probe) => !probe.succeeded))
      throw new Error('synthetic probe did not complete');
    await recordEvidenceProbeResults(
      stateDir,
      runId,
      probes.map((probe) => probe.id)
    );
  } catch (error) {
    await cleanupCloudflareEvidenceRunUnlocked(
      stateDir,
      runId,
      capability,
      client
    );
    throw error;
  }
  return cleanupCloudflareEvidenceRunUnlocked(
    stateDir,
    runId,
    capability,
    client
  );
}
export function cleanupCloudflareEvidenceRun(
  stateDir: string,
  runId: string,
  capability: VerifiedEvidenceTokenCapability,
  client: EvidenceMutationClient
) {
  return withEvidenceRunOperationLock(stateDir, runId, () =>
    cleanupCloudflareEvidenceRunUnlocked(stateDir, runId, capability, client)
  );
}
async function cleanupCloudflareEvidenceRunUnlocked(
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
  if (journal.phase === 'cleanup_verified') {
    if (cleanupTokenToRevoke) {
      await revokeCleanupWriteTokenIfNeeded(
        stateDir,
        runId,
        cleanupTokenToRevoke,
        client
      );
    }
    if (!replacement)
      await revokeWriteTokenIfAvailable(stateDir, runId, client);
    return loadEvidenceRunForCleanup(stateDir, runId);
  }
  const incomplete = journal.probeResults.length !== journal.expectedProbeCount;
  // Complete cleanup requires provider readback before destructive calls.
  if (!incomplete && typeof client.verifyCleanup !== 'function')
    throw new Error('cleanup verification requires provider readback');
  // Recover only deterministic pre-journaled names after an API/journal gap.
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
)
  runMutationCliFromProcess(runMutationCommand);
