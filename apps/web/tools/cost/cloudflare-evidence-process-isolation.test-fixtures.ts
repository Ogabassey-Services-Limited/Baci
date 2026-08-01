import { writeFile } from 'node:fs/promises';

export async function writeProtectedMergeIdentity(
  path: string,
  mergeSha: string
) {
  await writeFile(
    path,
    JSON.stringify({
      reviewedHeadSha: 'd'.repeat(40),
      requiredChecksSha: 'e'.repeat(40),
      mergeSha,
      mergeMethod: 'squash',
      protectedRef: `refs/tags/storefront-ogabassey-rollout-${mergeSha}-${'f'.repeat(16)}`,
      protectedRefTargetSha: mergeSha,
      protectedTagObjectSha: '1'.repeat(40),
      reviewId: 'review-123',
      reviewAuthor: 'reviewer',
      requiredCheckRunIds: ['123'],
      requiredCheckNames: ['Build'],
      artifactManifestSha256: 'a'.repeat(64),
    }),
    { mode: 0o600 }
  );
}
