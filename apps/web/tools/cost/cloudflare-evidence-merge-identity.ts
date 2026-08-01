import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { importReviewedEvidenceModule } from './cloudflare-evidence-reviewed-module-loader';
import { verifyReviewedEvidenceRunnerModule } from './cloudflare-evidence-runner-modules';

const sha1 = z.string().regex(/^[a-f0-9]{40}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const boundedId = z.string().min(1).max(128).regex(/^\S+$/);

/** Owner-provisioned receipt for the exact reviewed, checked, and protected merge. */
export const ProtectedMergeIdentitySchema = z
  .object({
    reviewedHeadSha: sha1,
    requiredChecksSha: sha1,
    mergeSha: sha1,
    mergeMethod: z.enum(['merge', 'squash', 'rebase']),
    protectedRef: z
      .string()
      .regex(
        /^refs\/tags\/storefront-ogabassey-rollout-[a-f0-9]{40}-[a-f0-9]{16}$/
      ),
    protectedRefTargetSha: sha1,
    protectedTagObjectSha: sha1,
    reviewId: boundedId,
    reviewAuthor: boundedId,
    requiredCheckRunIds: z.array(z.string().regex(/^\d+$/)).min(1).max(64),
    requiredCheckNames: z.array(boundedId).min(1).max(64),
    artifactManifestSha256: sha256,
  })
  .strict()
  .superRefine((value, context) => {
    const tagSha = value.protectedRef.match(
      /^refs\/tags\/storefront-ogabassey-rollout-([a-f0-9]{40})-/
    )?.[1];
    if (
      value.mergeSha !== value.protectedRefTargetSha ||
      value.mergeSha !== tagSha
    )
      context.addIssue({
        code: 'custom',
        message: 'protected merge identity does not match the tagged merge',
        path: ['protectedRef'],
      });
    if (
      new Set(value.requiredCheckRunIds).size !==
      value.requiredCheckRunIds.length
    )
      context.addIssue({
        code: 'custom',
        message: 'required check run IDs must be unique',
        path: ['requiredCheckRunIds'],
      });
    if (
      new Set(value.requiredCheckNames).size !== value.requiredCheckNames.length
    )
      context.addIssue({
        code: 'custom',
        message: 'required check names must be unique',
        path: ['requiredCheckNames'],
      });
  });

export type ProtectedMergeIdentity = z.infer<
  typeof ProtectedMergeIdentitySchema
>;

/**
 * Resolves the protected merge identity from an authenticated source.
 *
 * The resolver must perform the GitHub/tag API (or signed-attestation)
 * verification itself and return the complete response-derived identity. It
 * deliberately receives only the tooling SHA, never a caller-selected review,
 * check, or tag field.
 */
export type ProtectedMergeIdentityAuthorityResolver = (
  toolingMergeSha: string
) => ProtectedMergeIdentity | Promise<ProtectedMergeIdentity>;

export type ProtectedMergeIdentityAuthorityModuleDescriptor = Readonly<{
  path: string;
  sha256: string;
}>;

/** Loads only a module whose bytes are tracked by the exact reviewed commit. */
export async function loadProtectedMergeIdentityAuthority(
  workspaceRoot: string,
  toolingMergeSha: string,
  descriptor: ProtectedMergeIdentityAuthorityModuleDescriptor
): Promise<ProtectedMergeIdentityAuthorityResolver> {
  if (!isAbsolute(workspaceRoot) || !isAbsolute(descriptor.path))
    throw new Error('protected merge authority module paths must be absolute');
  if (!/^[a-f0-9]{64}$/.test(descriptor.sha256))
    throw new Error('protected merge authority module hash is invalid');
  const verified = await verifyReviewedEvidenceRunnerModule(
    workspaceRoot,
    toolingMergeSha,
    descriptor
  );
  return async (requestedToolingMergeSha: string) =>
    importReviewedEvidenceModule(
      workspaceRoot,
      verified.path,
      verified.files,
      (loaded) => {
        if (
          !loaded ||
          typeof loaded !== 'object' ||
          !('resolveProtectedMergeIdentityAuthority' in loaded) ||
          typeof loaded.resolveProtectedMergeIdentityAuthority !== 'function'
        )
          throw new Error(
            'protected merge authority module must export resolveProtectedMergeIdentityAuthority'
          );
        return (
          loaded.resolveProtectedMergeIdentityAuthority as ProtectedMergeIdentityAuthorityResolver
        )(requestedToolingMergeSha);
      }
    );
}

export function readProtectedMergeIdentityAuthorityModuleDescriptor(
  environment: Readonly<Record<string, string | undefined>>
): ProtectedMergeIdentityAuthorityModuleDescriptor {
  const path = environment.EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE;
  const sha256 = environment.EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE_SHA256;
  if (!path || !sha256)
    throw new Error(
      'authenticated protected merge authority module descriptor is required'
    );
  return Object.freeze({ path, sha256 });
}

function sameIdentity(
  left: ProtectedMergeIdentity,
  right: ProtectedMergeIdentity
) {
  return (
    left.reviewedHeadSha === right.reviewedHeadSha &&
    left.requiredChecksSha === right.requiredChecksSha &&
    left.mergeSha === right.mergeSha &&
    left.mergeMethod === right.mergeMethod &&
    left.protectedRef === right.protectedRef &&
    left.protectedRefTargetSha === right.protectedRefTargetSha &&
    left.protectedTagObjectSha === right.protectedTagObjectSha &&
    left.reviewId === right.reviewId &&
    left.reviewAuthor === right.reviewAuthor &&
    left.requiredCheckRunIds.length === right.requiredCheckRunIds.length &&
    left.requiredCheckRunIds.every(
      (value, index) => value === right.requiredCheckRunIds[index]
    ) &&
    left.requiredCheckNames.length === right.requiredCheckNames.length &&
    left.requiredCheckNames.every(
      (value, index) => value === right.requiredCheckNames[index]
    ) &&
    left.artifactManifestSha256 === right.artifactManifestSha256
  );
}

export function verifyProtectedMergeIdentity(
  value: unknown,
  toolingMergeSha: string
): ProtectedMergeIdentity {
  const identity = ProtectedMergeIdentitySchema.parse(value);
  if (
    !sha1.safeParse(toolingMergeSha).success ||
    identity.mergeSha !== toolingMergeSha
  )
    throw new Error(
      'protected merge identity does not match tooling merge SHA'
    );
  return identity;
}

/**
 * Verifies a receipt against an independently authenticated authority.
 *
 * `verifyProtectedMergeIdentity` remains a schema/tooling-SHA parser for
 * callers that need to inspect an untrusted handoff. It must not be used as
 * proof of a protected merge. Prepare uses this authority-bound variant and
 * fails closed when no resolver is supplied or when any response-derived
 * field differs.
 */
export async function verifyProtectedMergeIdentityWithAuthority(
  value: unknown,
  toolingMergeSha: string,
  resolveAuthority: ProtectedMergeIdentityAuthorityResolver | undefined
): Promise<ProtectedMergeIdentity> {
  if (!resolveAuthority)
    throw new Error(
      'an authenticated GitHub/tag authority or signed attestation is required'
    );
  const identity = verifyProtectedMergeIdentity(value, toolingMergeSha);
  const authoritative = ProtectedMergeIdentitySchema.parse(
    await resolveAuthority(toolingMergeSha)
  );
  if (!sameIdentity(identity, authoritative))
    throw new Error(
      'protected merge identity does not match authenticated authority'
    );
  return identity;
}
