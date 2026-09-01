import type { RefinementCtx } from 'zod';
import { collectPublicProjectionReleaseAssetUrls } from './collect-public-projection-release-asset-urls';

interface MediaRow {
  publicUrl: string;
}

/** Ensures content-addressed URLs in release content have a declared media row. */
export function validatePublicProjectionMediaOwnership(
  releaseContent: unknown,
  media: readonly MediaRow[] | undefined,
  context: RefinementCtx
): void {
  const declaredMediaUrls = new Set(
    (media ?? []).map((entry) => entry.publicUrl)
  );
  for (const url of collectPublicProjectionReleaseAssetUrls(releaseContent))
    if (!declaredMediaUrls.has(url))
      context.addIssue({
        code: 'custom',
        message:
          'Content-addressed release assets must resolve to payload.media',
        path: ['media'],
      });
}
