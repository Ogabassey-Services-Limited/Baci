'use server';

import { getBlogPreviewSecret } from '@/env';
import { ensurePermission } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';

/**
 * Generate a secure preview URL for a blog post.
 * 2026 Best Practice: Keep secrets on the server and use server actions for secure URL generation.
 * IMPORTANT: encodeURIComponent is required for secrets containing special characters like +, /, =
 */
export async function getPreviewUrl(merchantSlug: string, postSlug: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { merchant } = await ensurePermission('marketing', 'view');

  if (merchant.slug !== merchantSlug) {
    throw new Error('Merchant not found or access denied');
  }

  const secret = await Promise.resolve(getBlogPreviewSecret());
  // URL-encode the secret to handle special characters (e.g., + becomes %2B)
  const encodedSecret = encodeURIComponent(secret);
  const encodedPostSlug = encodeURIComponent(postSlug);
  const encodedMerchantSlug = encodeURIComponent(merchantSlug);
  return `/api/blog/preview?secret=${encodedSecret}&slug=${encodedPostSlug}&merchantSlug=${encodedMerchantSlug}`;
}
