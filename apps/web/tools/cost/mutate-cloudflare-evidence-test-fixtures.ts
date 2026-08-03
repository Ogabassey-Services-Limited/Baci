import {
  createReviewedTemporaryRuleBinding,
  EVIDENCE_HOSTNAME,
  SYNTHETIC_PATHS,
} from './mutate-cloudflare-evidence-validation';

export const mutationInput = {
  runId: '0123456789abcdef0123456789abcdef',
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  policySha256: 'b'.repeat(64),
  cleanupPolicySha256: 'd'.repeat(64),
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['baci-evidence-0123456789abcdef0123456789abcdef'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

export const mutationCapability = {
  ...mutationInput,
  tokenId: 'write',
  permissionGroupIds: ['workers.write'],
  resources: ['account'],
  expiresAt: '2026-08-01T00:00:00.000Z',
  policySha256: 'b'.repeat(64),
  kind: 'write' as const,
  providerNegativeScopeUnverified: true as const,
};

export type ReplacementCapability = Omit<
  typeof mutationCapability,
  'policySha256'
> &
  Readonly<{
    policySha256: string;
    replacementForTokenId: string;
    cleanupOnly: true;
  }>;

export const mutationResource = {
  id: 'resource-1',
  name: 'baci-evidence-0123456789abcdef0123456789abcdef',
  description: 'baci evidence 0123456789abcdef0123456789abcdef',
  accountId: 'account',
  zoneId: 'zone',
  hostname: 'edge-evidence.ogabassey.com',
  paths: ['/__baci-evidence/a', '/__baci-evidence/b'],
  temporaryRule: createReviewedTemporaryRuleBinding(mutationInput.runId),
};

export const cleanupReceipt = {
  verifyCleanup: async () => ({
    status: 'absent' as const,
    inventorySha256: 'a'.repeat(64),
    providerReceiptSha256: 'e'.repeat(64),
    observedAt: '2026-07-31T00:00:00.000Z',
  }),
};

export function reviewedProbeResults(
  runId = mutationInput.runId,
  succeeded: readonly boolean[] = [true, true]
) {
  const headers = createReviewedTemporaryRuleBinding(runId).headers;
  return SYNTHETIC_PATHS.map((path, index) => ({
    id: `probe-${index}`,
    succeeded: succeeded[index] ?? false,
    hostname: EVIDENCE_HOSTNAME,
    method: 'GET' as const,
    path,
    headers,
  }));
}

export function externalReadTokenRevocationDependencies(
  readTokenId: string,
  observedAt: string,
  providerReceiptSha256 = 'e'.repeat(64)
) {
  const revocationReceipt = {
    tokenId: readTokenId,
    status: 'revoked' as const,
    providerReceiptSha256,
    observedAt,
  };
  return {
    revocationReceipt,
    client: {
      readBack: async (tokenId: string) => ({
        tokenId,
        status: 'inactive' as const,
        auditReceiptSha256: revocationReceipt.providerReceiptSha256,
        observedAt: revocationReceipt.observedAt,
      }),
    },
  };
}
