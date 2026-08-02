import type {
  CloudflareEvidenceRunJournal,
  TokenRevocationClient,
  TokenRevocationReceipt,
} from './cloudflare-evidence-run-journal';
import { requireTokenReadBackClient } from './mutate-cloudflare-evidence-cleanup-support';
import type {
  EvidenceMutationClient,
  EvidenceMutationDependencies,
} from './mutate-cloudflare-evidence-support';
import {
  isEvidenceMutationClient,
  parseMutationArguments,
} from './mutate-cloudflare-evidence-support';
import type { VerifiedEvidenceTokenCapability } from './verify-cloudflare-evidence-token-policy';

type MutationOperations = Readonly<{
  apply: (
    stateDir: string,
    runId: string,
    capability: VerifiedEvidenceTokenCapability,
    client: EvidenceMutationClient
  ) => Promise<CloudflareEvidenceRunJournal>;
  cleanup: (
    stateDir: string,
    runId: string,
    capability: VerifiedEvidenceTokenCapability,
    client: EvidenceMutationClient
  ) => Promise<CloudflareEvidenceRunJournal>;
  recordRevocation: (
    stateDir: string,
    runId: string,
    receipt: TokenRevocationReceipt,
    client: Pick<TokenRevocationClient, 'readBack'>
  ) => Promise<CloudflareEvidenceRunJournal>;
}>;

export function dispatchMutationCommand(
  args: readonly string[],
  stateDir: string,
  dependencies: EvidenceMutationDependencies,
  operations: MutationOperations
) {
  const parsed = parseMutationArguments(args);
  if (parsed.mode === 'record_write_revocation') {
    if (!dependencies.revocationReceipt)
      throw new Error('an externally verified write-token receipt is required');
    return operations.recordRevocation(
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
  const operation =
    parsed.mode === 'apply' ? operations.apply : operations.cleanup;
  return operation(
    stateDir,
    parsed.runId,
    dependencies.capability,
    dependencies.client
  );
}

export function createMutationCommand(operations: MutationOperations) {
  return (
    args: readonly string[],
    stateDir: string,
    dependencies: EvidenceMutationDependencies
  ) => dispatchMutationCommand(args, stateDir, dependencies, operations);
}
