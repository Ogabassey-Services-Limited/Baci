import { z } from 'zod';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
} from '../../../../packages/shared/src/storefront/delivery-evidence';

const policySchema = z
  .object({
    tokenId: z.string().min(1),
    accountId: z.string().min(1),
    zoneId: z.string().min(1),
    permissionGroupIds: z.array(z.string().min(1)).min(1),
    resources: z.array(z.string().min(1)).min(1),
    expiresAt: z.string().datetime({ offset: true }),
    policySha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type CloudflareEvidenceTokenPolicy = z.infer<typeof policySchema>;
export type CloudflareTokenVerificationClient = {
  verify(token: string): Promise<{ id: string; status: string }>;
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
  const live = await client.verify(liveToken);
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
  const expiresAtMs = new Date(owner.expiresAt).valueOf();
  const maximumLifetimeMs = options.maximumLifetimeMs ?? 2 * 60 * 60 * 1000;
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= nowMs
  )
    throw new Error('Cloudflare token policy is expired');
  if (
    !Number.isFinite(maximumLifetimeMs) ||
    maximumLifetimeMs <= 0 ||
    expiresAtMs - nowMs > maximumLifetimeMs
  )
    throw new Error('Cloudflare token policy exceeds its maximum lifetime');
  return Object.freeze({
    ...owner,
    kind: 'write' as const,
    providerNegativeScopeUnverified: true as const,
  });
}
