import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve a merchant's id from a storefront slug, falling back to
 * `merchant_slug_aliases` when the slug was retired by a "Change store URL"
 * rename (see 20260707074000_merchant_slug_rename_flow.sql).
 *
 * Storefront API routes that receive the merchant slug in the REQUEST BODY use
 * this: the proxy rewrites stale slugs in the URL query and the merchant header,
 * but it cannot safely rewrite a (possibly streamed/multipart) request body. So a
 * stale client still on `old.usebaci.com` that POSTs `{ merchantSlug: "old" }`
 * right after a rename would otherwise 404 with "Store not found". Resolving the
 * alias here keeps that in-flight request working.
 *
 * A LIVE merchant always wins over a retired alias because the direct
 * `merchants.slug` lookup runs first (and the collision trigger prevents a new
 * store from ever claiming a retired alias). Returns `{ merchantId, error }`:
 * `error` is set only when a DB query itself failed (not for a plain not-found).
 */
export async function resolveMerchantIdBySlugOrAlias(
  supabase: SupabaseClient,
  slug: string
): Promise<{ merchantId: string | null; error: unknown }> {
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    return { merchantId: null, error };
  }
  if (merchant?.id) {
    return { merchantId: merchant.id as string, error: null };
  }

  const { data: alias, error: aliasError } = await supabase
    .from('merchant_slug_aliases')
    .select('merchant_id')
    .eq('old_slug', slug)
    .maybeSingle();

  if (aliasError) {
    return { merchantId: null, error: aliasError };
  }

  return {
    merchantId: (alias?.merchant_id as string | undefined) ?? null,
    error: null,
  };
}
