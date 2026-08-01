import { z } from 'zod';

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
    policySchema.parse(reviewedPolicy),
  ];
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
