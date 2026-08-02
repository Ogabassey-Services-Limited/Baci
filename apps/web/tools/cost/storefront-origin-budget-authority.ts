import { z } from 'zod';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
} from '../../../../packages/shared/src/storefront/delivery-evidence';
import type { StorefrontDeliveryEvidenceManifest } from '../../../../packages/shared/src/storefront/delivery-evidence-manifest';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';
import { verifyReviewedEvidenceRunnerModule } from './cloudflare-evidence-runner-modules';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const ManifestAuthoritySchema = z
  .object({
    source: z.enum(['provider_signed', 'audit_verified']),
    manifestSha256: Hash,
    authorityReceiptSha256: Hash,
    verifiedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type StorefrontDeliveryManifestAuthorityResolver = () => z.infer<
  typeof ManifestAuthoritySchema
>;
type ManifestAuthorityModule = Readonly<{
  resolveStorefrontDeliveryManifestAuthority: () => unknown | Promise<unknown>;
}>;

export async function loadStorefrontDeliveryManifestAuthority(
  environment: Readonly<Record<string, string | undefined>>
): Promise<StorefrontDeliveryManifestAuthorityResolver> {
  const workspaceRoot = environment.EVIDENCE_WORKSPACE_ROOT;
  const toolingMergeSha = environment.EVIDENCE_TOOLING_MERGE_SHA;
  const path = environment.STOREFRONT_MANIFEST_AUTHORITY_MODULE;
  const sha256 = environment.STOREFRONT_MANIFEST_AUTHORITY_MODULE_SHA256;
  if (!workspaceRoot || !toolingMergeSha || !path || !sha256)
    throw new Error('reviewed production manifest authority is required');
  const verified = await verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    toolingMergeSha,
    { path, sha256 }
  );
  const authority = await importReviewedEvidenceModule(
    workspaceRoot,
    verified.path,
    verified.files,
    async (loaded) => {
      const resolver = (loaded as Partial<ManifestAuthorityModule>)
        ?.resolveStorefrontDeliveryManifestAuthority;
      if (typeof resolver !== 'function')
        throw new Error('production manifest authority module is invalid');
      const parsed = ManifestAuthoritySchema.safeParse(await resolver());
      if (!parsed.success)
        throw new Error('production manifest authority module is invalid');
      return parsed.data;
    }
  );
  return () => authority;
}

export function calculateStorefrontDeliveryManifestAuthoritySha256(
  manifest: StorefrontDeliveryEvidenceManifest
) {
  return calculateCanonicalSha256(
    canonicalizeJson({
      domain: 'baci:storefront-delivery-manifest-authority:v1',
      manifest,
    })
  );
}

export function authenticateStorefrontDeliveryManifest(
  manifest: StorefrontDeliveryEvidenceManifest,
  resolver: StorefrontDeliveryManifestAuthorityResolver | undefined,
  now: Date
) {
  if (typeof resolver !== 'function')
    throw new Error('production manifest authority is required');
  let authority: z.infer<typeof ManifestAuthoritySchema>;
  try {
    authority = ManifestAuthoritySchema.parse(resolver());
  } catch {
    throw new Error('production manifest authority is invalid');
  }
  const verifiedAt = Date.parse(authority.verifiedAt);
  if (
    authority.manifestSha256 !==
      calculateStorefrontDeliveryManifestAuthoritySha256(manifest) ||
    !Number.isFinite(verifiedAt) ||
    verifiedAt > now.valueOf()
  )
    throw new Error('production manifest authority does not match');
}
