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
export type ReviewedCloudflarePermissionMetadata = Readonly<{
  id: string;
  capability: 'read' | 'write' | 'admin';
}>;

/** Verifies a distinct read-only token; it cannot be used where mutation capability is required. */
export async function verifyCloudflareEvidenceReadTokenPolicy(
  liveToken: string,
  ownerExport: unknown,
  reviewedPolicy: unknown,
  client: CloudflareTokenVerificationClient,
  permissionMetadata: readonly ReviewedCloudflarePermissionMetadata[] = []
): Promise<VerifiedEvidenceReadCapability> {
  const verified = await verifyCloudflareEvidenceTokenPolicy(
    liveToken,
    ownerExport,
    reviewedPolicy,
    client
  );
  for (const permissionId of verified.permissionGroupIds) {
    const metadata = permissionMetadata.find(
      (entry) => entry.id === permissionId
    );
    if (!metadata)
      throw new Error(
        'Cloudflare read token permission is not in the reviewed allowlist'
      );
    if (metadata.capability !== 'read')
      throw new Error(
        'Cloudflare read token contains a write or non-read-only permission'
      );
  }
  return Object.freeze({ ...verified, kind: 'read' as const });
}
