'use server';

import { getBlogPreviewSecret } from '@/env';

/**
 * Generate a secure preview URL for a blog post.
 * 2026 Best Practice: Keep secrets on the server and use server actions for secure URL generation.
 * IMPORTANT: encodeURIComponent is required for secrets containing special characters like +, /, =
 */
export async function getPreviewUrl(merchantSlug: string, postSlug: string) {
  const secret = await Promise.resolve(getBlogPreviewSecret());
  // URL-encode the secret to handle special characters (e.g., + becomes %2B)
  const encodedSecret = encodeURIComponent(secret);
  return `/api/blog/preview?secret=${encodedSecret}&slug=${postSlug}&merchantSlug=${merchantSlug}`;
}
