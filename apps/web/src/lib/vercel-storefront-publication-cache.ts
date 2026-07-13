import 'server-only';

import { dangerouslyDeleteByTag } from '@vercel/functions';

// Vercel documents 16 tags per bulk REST purge. The runtime API shares the
// purge control plane but does not publish a separate bulk limit, so use the
// stricter documented bound and await every batch before moving outward.
const MAX_TAGS_PER_DELETE = 16;

type VercelStorefrontPublicationCacheResult =
  | {
      ok: true;
      reason: 'deleted' | 'not_required' | 'not_running_on_vercel';
    }
  | { ok: false; reason: 'request_failed' };

interface VercelStorefrontPublicationCacheOptions {
  deleteByTag?: typeof dangerouslyDeleteByTag;
  isVercel?: boolean;
}

/**
 * Delete tenant-scoped Data/Runtime/CDN cache tags in the foreground. Vercel's
 * tag purge spans all three cache types, so publication transitions are not
 * complete until every batch resolves.
 */
export async function purgeVercelStorefrontPublicationCache(
  tags: readonly string[],
  options: VercelStorefrontPublicationCacheOptions = {}
): Promise<VercelStorefrontPublicationCacheResult> {
  const uniqueTags = Array.from(
    new Set(tags.map((tag) => tag.trim()).filter(Boolean))
  );
  if (uniqueTags.length === 0) {
    return { ok: true, reason: 'not_required' };
  }

  const isVercel = options.isVercel ?? process.env.VERCEL === '1';
  if (!isVercel) {
    return { ok: true, reason: 'not_running_on_vercel' };
  }

  try {
    const deleteByTag = options.deleteByTag ?? dangerouslyDeleteByTag;
    for (
      let index = 0;
      index < uniqueTags.length;
      index += MAX_TAGS_PER_DELETE
    ) {
      await deleteByTag(uniqueTags.slice(index, index + MAX_TAGS_PER_DELETE), {
        revalidationDeadlineSeconds: 0,
      });
    }
    return { ok: true, reason: 'deleted' };
  } catch (error) {
    console.error('Vercel storefront publication cache deletion failed', {
      error,
      tags: uniqueTags,
    });
    return { ok: false, reason: 'request_failed' };
  }
}
