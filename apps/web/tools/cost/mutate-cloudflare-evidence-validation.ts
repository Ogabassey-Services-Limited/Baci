import type {
  TokenRevocationClient,
  TokenRevocationReceipt,
} from './cloudflare-evidence-run-journal';
import {
  type loadEvidenceRunForCleanup,
  RUN_ID_PATTERN,
} from './cloudflare-evidence-run-journal';
import {
  EVIDENCE_HOSTNAME,
  type EvidenceTemporaryRuleBinding,
  REVIEWED_TEMPORARY_RULE_BINDING,
  verifyTemporaryRule,
} from './mutate-cloudflare-evidence-rule-binding';
import type { VerifiedEvidenceTokenCapability } from './verify-cloudflare-evidence-token-policy';

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export const SYNTHETIC_PATHS = [
  '/__baci-evidence/a',
  '/__baci-evidence/b',
] as const;

export type {
  EvidenceRuleHeader,
  EvidenceTemporaryRuleBinding,
} from './mutate-cloudflare-evidence-rule-binding';
export {
  calculateEvidenceTemporaryRuleCanonicalSha256,
  EVIDENCE_HOSTNAME,
  REVIEWED_TEMPORARY_RULE_BINDING,
  verifyTemporaryRule,
} from './mutate-cloudflare-evidence-rule-binding';

export type EvidenceResource = Readonly<{
  id: string;
  name: string;
  description: string;
  accountId: string;
  zoneId: string;
  hostname: string;
  paths: readonly string[];
  temporaryRule: EvidenceTemporaryRuleBinding;
}>;
export type EvidenceProbeResult = Readonly<{ id: string; succeeded: boolean }>;
export type EvidenceMutationClient = {
  identity(): Promise<{ accountId: string; zoneId: string }>;
  findByName(name: string): Promise<EvidenceResource | null>;
  get(id: string): Promise<EvidenceResource | null>;
  create(
    name: string,
    hostname: string,
    paths: readonly string[],
    temporaryRule: EvidenceTemporaryRuleBinding
  ): Promise<{ id: string }>;
  probe(resource: EvidenceResource): Promise<readonly EvidenceProbeResult[]>;
  cleanup(name: string, id: string): Promise<boolean>;
  inventorySha256(excluding?: EvidenceResource): Promise<string>;
  inventorySha256Excluding?: (
    excluding: readonly EvidenceResource[]
  ) => Promise<string>;
  verifyCleanup?: (
    runId: string,
    expectedInventorySha256: string
  ) => Promise<{
    status: 'absent';
    inventorySha256: string;
    providerReceiptSha256: string;
    observedAt: string;
  }>;
  revoke?: TokenRevocationClient['revoke'];
  readBack?: TokenRevocationClient['readBack'];
};
export type EvidenceReadbackClient = Pick<TokenRevocationClient, 'readBack'>;
export type EvidenceMutationDependencies = Readonly<{
  capability?: VerifiedEvidenceTokenCapability;
  client: EvidenceMutationClient | EvidenceReadbackClient;
  revocationReceipt?: TokenRevocationReceipt;
}>;
export type MutationMode = 'apply' | 'cleanup' | 'record_write_revocation';
export type EvidenceJournal = Awaited<
  ReturnType<typeof loadEvidenceRunForCleanup>
> &
  Readonly<{
    /** Optional approval for a cleanup-only replacement token. */
    cleanupPolicySha256?: string;
  }>;

type CleanupReplacementCapability = VerifiedEvidenceTokenCapability &
  Readonly<{
    replacementForTokenId: string;
    cleanupOnly: true;
  }>;

function isCleanupReplacementCapability(
  capability: VerifiedEvidenceTokenCapability
): capability is CleanupReplacementCapability {
  return (
    'replacementForTokenId' in capability &&
    typeof capability.replacementForTokenId === 'string' &&
    'cleanupOnly' in capability &&
    capability.cleanupOnly === true
  );
}

export function parseMutationArguments(args: readonly string[]) {
  if (
    args.length === 2 &&
    args[0] === '--cleanup-run' &&
    args[1] &&
    RUN_ID_PATTERN.test(args[1])
  )
    return { mode: 'cleanup' as const, runId: args[1] };
  if (
    args.length === 2 &&
    (args[0] === '--record-write-revocation' ||
      args[0] === '--record-write-token-revocation') &&
    args[1] &&
    RUN_ID_PATTERN.test(args[1])
  )
    return { mode: 'record_write_revocation' as const, runId: args[1] };
  if (
    args.length !== 3 ||
    args[0] !== '--run' ||
    !args[1] ||
    !RUN_ID_PATTERN.test(args[1]) ||
    args[2] !== '--apply'
  )
    throw new Error(
      'mutation accepts only --run <runId> --apply, --cleanup-run <runId>, or --record-write-revocation <runId>'
    );
  return { mode: 'apply' as const, runId: args[1] };
}

export function isEvidenceMutationClient(
  client: EvidenceMutationClient | EvidenceReadbackClient
): client is EvidenceMutationClient {
  if (!client || typeof client !== 'object') return false;
  const candidate = client as Partial<EvidenceMutationClient>;
  return (
    typeof candidate.identity === 'function' &&
    typeof candidate.findByName === 'function' &&
    typeof candidate.get === 'function' &&
    typeof candidate.create === 'function' &&
    typeof candidate.probe === 'function' &&
    typeof candidate.cleanup === 'function' &&
    typeof candidate.inventorySha256 === 'function'
  );
}

export function verifyCapability(
  capability: VerifiedEvidenceTokenCapability,
  journal: EvidenceJournal,
  mode: 'apply' | 'cleanup'
) {
  if (capability.kind !== 'write')
    throw new Error('a verified write capability is required');
  if (
    capability.accountId !== journal.accountId ||
    capability.zoneId !== journal.zoneId
  )
    throw new Error('write capability does not match the journaled authority');
  if (capability.tokenId === journal.writeTokenId) {
    if (
      journal.policySha256 &&
      capability.policySha256 !== journal.policySha256
    )
      throw new Error('write capability policy does not match the journal');
    return;
  }
  if (capability.tokenId === journal.readTokenId)
    throw new Error('cleanup replacement token cannot be the read token');

  const approvedCleanupPolicySha256 = journal.cleanupPolicySha256;
  if (
    mode !== 'cleanup' ||
    !isCleanupReplacementCapability(capability) ||
    capability.replacementForTokenId !== journal.writeTokenId ||
    !approvedCleanupPolicySha256 ||
    !HASH_PATTERN.test(approvedCleanupPolicySha256) ||
    capability.policySha256 !== approvedCleanupPolicySha256
  )
    throw new Error('write capability does not match the journaled authority');
}

export function verifyIdentity(
  actual: { accountId: string; zoneId: string },
  expected: { accountId: string; zoneId: string }
) {
  if (actual.accountId !== expected.accountId)
    throw new Error('provider account does not match journal');
  if (actual.zoneId !== expected.zoneId)
    throw new Error('provider zone does not match journal');
}

export function verifyResource(
  resource: EvidenceResource,
  journal: EvidenceJournal,
  name: string,
  expectedId?: string,
  expectedTemporaryRule: EvidenceTemporaryRuleBinding = REVIEWED_TEMPORARY_RULE_BINDING
) {
  if (
    !resource.id ||
    (expectedId && resource.id !== expectedId) ||
    resource.name !== name ||
    resource.description !== `baci evidence ${journal.runId}` ||
    resource.accountId !== journal.accountId ||
    resource.zoneId !== journal.zoneId ||
    resource.hostname !== EVIDENCE_HOSTNAME ||
    resource.paths.length !== SYNTHETIC_PATHS.length ||
    resource.paths.some((path, index) => path !== SYNTHETIC_PATHS[index])
  )
    throw new Error(
      'journaled resource identity does not match provider read-back'
    );
  verifyTemporaryRule(resource.temporaryRule, expectedTemporaryRule);
}
