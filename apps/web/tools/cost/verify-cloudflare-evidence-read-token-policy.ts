import type {
  CloudflareEvidenceTokenPolicy,
  CloudflareTokenVerificationClient,
} from './verify-cloudflare-evidence-token-policy';
import { verifyCloudflareEvidenceTokenPolicy } from './verify-cloudflare-evidence-token-policy';

export type VerifiedEvidenceReadCapability = Readonly<
  CloudflareEvidenceTokenPolicy & {
    readonly kind: 'read';
    readonly providerNegativeScopeUnverified: true;
  }
>;

/** Verifies a distinct read-only token; it cannot be used where mutation capability is required. */
export async function verifyCloudflareEvidenceReadTokenPolicy(
  liveToken: string,
  ownerExport: unknown,
  reviewedPolicy: unknown,
  client: CloudflareTokenVerificationClient
): Promise<VerifiedEvidenceReadCapability> {
  const verified = await verifyCloudflareEvidenceTokenPolicy(
    liveToken,
    ownerExport,
    reviewedPolicy,
    client
  );
  if (
    verified.permissionGroupIds.some((permission) =>
      /(?:write|edit|delete|purge|create)/i.test(permission)
    )
  )
    throw new Error('Cloudflare read token contains a write permission');
  return Object.freeze({ ...verified, kind: 'read' as const });
}
