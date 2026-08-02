import type { EvidenceRunInput } from './cloudflare-evidence-run-journal';
import type { VerifiedEvidenceReadCapability } from './verify-cloudflare-evidence-read-token-policy';

export const measurementInput: EvidenceRunInput = {
  runId: '0123456789abcdef0123456789abcdef',
  approvalId: 'approval',
  policyId: 'policy',
  policySha256: 'b'.repeat(64),
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['baci-evidence-0123456789abcdef0123456789abcdef'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

export const measurementCapability: VerifiedEvidenceReadCapability = {
  ...measurementInput,
  tokenId: 'read',
  permissionGroupIds: ['analytics.read'],
  resources: ['account'],
  expiresAt: '2026-08-01T00:00:00.000Z',
  policySha256: measurementInput.readPolicySha256,
  kind: 'read',
  providerNegativeScopeUnverified: true,
};
