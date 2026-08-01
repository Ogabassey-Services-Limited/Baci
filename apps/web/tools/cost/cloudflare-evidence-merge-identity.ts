import { z } from 'zod';

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
