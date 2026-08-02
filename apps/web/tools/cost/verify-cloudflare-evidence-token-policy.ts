import { z } from 'zod';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
} from '../../../../packages/shared/src/storefront/delivery-evidence';

const PermissionMetadataSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const policySchema = z
  .object({
    tokenId: z.string().min(1),
    accountId: z.string().min(1),
    zoneId: z.string().min(1),
    permissionGroupIds: z.array(z.string().min(1)).min(1),
    resources: z.array(z.string().min(1)).min(1),
    expiresAt: z.iso.datetime({ offset: true }),
    /**
     * Owner-reviewed digest of the provider permission metadata. Read-token
     * verification requires this binding; write policies may omit it.
     */
    permissionMetadataSha256: PermissionMetadataSha256Schema.optional(),
    policySha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const tokenVerificationSchema = z
  .object({
    id: z.string().min(1),
    status: z.string().min(1),
    /** Authenticated provider creation time (Cloudflare's issued_on). */
    issuedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

// The token must cover the complete provider workflow: mutation, probe,
// cleanup, provider readback, both revocations, and a bounded recovery margin.
// The one-minute operation locks are not a workflow deadline.
export const MINIMUM_REMAINING_LIFETIME_MS = 10 * 60 * 1000;

export type CloudflareEvidenceTokenPolicy = z.infer<typeof policySchema>;
export type CloudflareTokenVerification = z.infer<
  typeof tokenVerificationSchema
>;
export type CloudflareTokenVerificationClient = {
  verify(token: string): Promise<CloudflareTokenVerification>;
};
export type TokenPolicyVerificationOptions = Readonly<{
  now?: () => Date;
  maximumLifetimeMs?: number;
}>;
export type VerifiedEvidenceTokenCapability = Readonly<
  CloudflareEvidenceTokenPolicy & {
    readonly kind: 'write';
    readonly providerNegativeScopeUnverified: true;
  }
>;

function equalList(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function reviewedPolicyValue(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'reviewedWriteTokenPolicy' in value
  ) {
    const envelope = value as {
      notProvisioned?: unknown;
      reviewedWriteTokenPolicy?: unknown;
    };
    if (envelope.notProvisioned === true)
      throw new Error('reviewed Cloudflare token policy is not provisioned');
    return envelope.reviewedWriteTokenPolicy;
  }
  return value;
}

export function calculateCloudflareEvidenceTokenPolicySha256(
  value: Omit<CloudflareEvidenceTokenPolicy, 'policySha256'>
) {
  return calculateCanonicalSha256(canonicalizeJson(value));
}

/** Verifies a separately exported, reviewed least-privilege write policy against token status. */
export async function verifyCloudflareEvidenceTokenPolicy(
  liveToken: string,
  ownerExport: unknown,
  reviewedPolicy: unknown,
  client: CloudflareTokenVerificationClient,
  options: TokenPolicyVerificationOptions = {}
): Promise<VerifiedEvidenceTokenCapability> {
  const [owner, reviewed] = [
    policySchema.parse(ownerExport),
    policySchema.parse(reviewedPolicyValue(reviewedPolicy)),
  ];
  const { policySha256: _ownerPolicySha256, ...ownerContent } = owner;
  const { policySha256: _reviewedPolicySha256, ...reviewedContent } = reviewed;
  if (
    owner.policySha256 !==
      calculateCloudflareEvidenceTokenPolicySha256(ownerContent) ||
    reviewed.policySha256 !==
      calculateCloudflareEvidenceTokenPolicySha256(reviewedContent)
  )
    throw new Error('Cloudflare token policy fingerprint is invalid');
  const live = tokenVerificationSchema.parse(await client.verify(liveToken));
  if (
    live.status !== 'active' ||
    live.id !== owner.tokenId ||
    live.id !== reviewed.tokenId
  )
    throw new Error(
      'Cloudflare token is inactive or does not match the reviewed policy'
    );
  if (
    owner.accountId !== reviewed.accountId ||
    owner.zoneId !== reviewed.zoneId ||
    owner.expiresAt !== reviewed.expiresAt ||
    owner.policySha256 !== reviewed.policySha256 ||
    !equalList(owner.permissionGroupIds, reviewed.permissionGroupIds) ||
    !equalList(owner.resources, reviewed.resources)
  )
    throw new Error('Cloudflare owner export does not equal reviewed policy');
  const now = (options.now ?? (() => new Date()))();
  const nowMs = now.valueOf();
  const issuedAtMs = new Date(live.issuedAt).valueOf();
  const expiresAtMs = new Date(owner.expiresAt).valueOf();
  const maximumLifetimeMs = options.maximumLifetimeMs ?? 2 * 60 * 60 * 1000;
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= nowMs
  )
    throw new Error('Cloudflare token policy is expired');
  const remainingLifetimeMs = expiresAtMs - nowMs;
  if (remainingLifetimeMs < MINIMUM_REMAINING_LIFETIME_MS)
    throw new Error(
      'Cloudflare token policy does not leave enough lifetime for mutation and cleanup'
    );
  if (
    !Number.isFinite(issuedAtMs) ||
    issuedAtMs > nowMs ||
    issuedAtMs >= expiresAtMs ||
    !Number.isFinite(maximumLifetimeMs) ||
    maximumLifetimeMs <= 0 ||
    expiresAtMs - issuedAtMs > maximumLifetimeMs
  )
    throw new Error('Cloudflare token policy exceeds its maximum lifetime');
  return Object.freeze({
    ...owner,
    kind: 'write' as const,
    providerNegativeScopeUnverified: true as const,
  });
}
