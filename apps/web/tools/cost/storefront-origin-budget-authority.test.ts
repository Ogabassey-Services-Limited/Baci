import { describe, expect, it, vi } from 'vitest';
import { manifest, seal } from './storefront-origin-budget.test-fixtures';
import {
  authenticateStorefrontDeliveryManifest,
  calculateStorefrontDeliveryManifestAuthoritySha256,
  loadStorefrontDeliveryManifestAuthority,
} from './storefront-origin-budget-authority';

const verifyReviewedEvidenceRunnerModule = vi.hoisted(() => vi.fn());
const importReviewedEvidenceModule = vi.hoisted(() => vi.fn());
vi.mock('./cloudflare-evidence-runner-modules', () => ({
  verifyReviewedEvidenceRunnerModule,
}));
vi.mock('./cloudflare-evidence-reviewed-module-loader', () => ({
  importReviewedEvidenceModule,
}));

describe('storefront origin budget manifest authority', () => {
  it('authenticates only the exact independently attested manifest', () => {
    const evidence = seal(manifest());
    const authority = () => ({
      source: 'audit_verified' as const,
      manifestSha256:
        calculateStorefrontDeliveryManifestAuthoritySha256(evidence),
      authorityReceiptSha256: 'a'.repeat(64),
      verifiedAt: '2026-07-31T00:00:00.000Z',
    });

    expect(() =>
      authenticateStorefrontDeliveryManifest(
        evidence,
        authority,
        new Date('2026-07-31T01:00:00.000Z')
      )
    ).not.toThrow();
    expect(() =>
      authenticateStorefrontDeliveryManifest(
        { ...evidence, deploymentId: 'fabricated' },
        authority,
        new Date('2026-07-31T01:00:00.000Z')
      )
    ).toThrow('does not match');
  });

  it('loads authority only through a reviewed exact-commit module', async () => {
    const evidence = seal(manifest());
    const authority = {
      source: 'provider_signed' as const,
      manifestSha256:
        calculateStorefrontDeliveryManifestAuthoritySha256(evidence),
      authorityReceiptSha256: 'b'.repeat(64),
      verifiedAt: '2026-07-31T00:00:00.000Z',
    };
    verifyReviewedEvidenceRunnerModule.mockResolvedValue({
      path: '/workspace/authority.mjs',
      files: ['/workspace/authority.mjs'],
    });
    importReviewedEvidenceModule.mockImplementation(
      async (_root, _path, _files, inspect) =>
        inspect({
          resolveStorefrontDeliveryManifestAuthority: () => authority,
        })
    );

    const resolver = await loadStorefrontDeliveryManifestAuthority({
      EVIDENCE_WORKSPACE_ROOT: '/workspace',
      EVIDENCE_TOOLING_MERGE_SHA: '1'.repeat(40),
      STOREFRONT_MANIFEST_AUTHORITY_MODULE: '/workspace/authority.mjs',
      STOREFRONT_MANIFEST_AUTHORITY_MODULE_SHA256: '2'.repeat(64),
    });

    expect(resolver()).toEqual(authority);
    expect(verifyReviewedEvidenceRunnerModule).toHaveBeenCalledWith(
      '/workspace',
      '1'.repeat(40),
      {
        path: '/workspace/authority.mjs',
        sha256: '2'.repeat(64),
      }
    );
  });
});
