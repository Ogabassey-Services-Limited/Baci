'use server';

import { getBlogPreviewSecret } from '@/env';

/**
 * Generate a secure preview URL for a blog post.
 * 2026 Best Practice: Keep secrets on the server and use server actions for secure URL generation.
 */
export async function getPreviewUrl(merchantSlug: string, postSlug: string) {
  const secret = await Promise.resolve(getBlogPreviewSecret());
  // Using absolute path for the API route
  return `/api/blog/preview?secret=${secret}&slug=${postSlug}&merchantSlug=${merchantSlug}`;
}
