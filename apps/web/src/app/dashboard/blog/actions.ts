'use server';

import { getBlogPreviewSecret } from '@/env';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { permissionGrantsAccess } from '@/lib/permission-grant';
import { createClient } from '@/lib/supabase/server';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

/**
 * Generate a secure preview URL for a blog post.
 * 2026 Best Practice: Keep secrets on the server and use server actions for secure URL generation.
 * IMPORTANT: encodeURIComponent is required for secrets containing special characters like +, /, =
 */
export async function getPreviewUrl(
  merchantId: string,
  merchantSlug: string,
  postSlug: string
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const parsedMerchantId = merchantIdParamSchema.safeParse(merchantId.trim());
  if (!parsedMerchantId.success) {
    throw new Error('Merchant not found or access denied');
  }

  const merchant = await getMerchantForApiRequest(supabase, user.id, {
    requestedMerchantId: parsedMerchantId.data,
  });
  const canViewMarketing =
    merchant?.staffAccess.isOwner ||
    (merchant
      ? permissionGrantsAccess(
          merchant.staffAccess.permissions,
          'marketing',
          'view'
        )
      : false);

  if (
    !merchant ||
    merchant.merchantId !== parsedMerchantId.data ||
    merchant.merchantSlug !== merchantSlug ||
    !canViewMarketing
  ) {
    throw new Error('Merchant not found or access denied');
  }

  const secret = await Promise.resolve(getBlogPreviewSecret());
  // URL-encode the secret to handle special characters (e.g., + becomes %2B)
  const encodedSecret = encodeURIComponent(secret);
  const encodedPostSlug = encodeURIComponent(postSlug);
  const encodedMerchantSlug = encodeURIComponent(merchantSlug);
  return `/api/blog/preview?secret=${encodedSecret}&slug=${encodedPostSlug}&merchantSlug=${encodedMerchantSlug}`;
}
