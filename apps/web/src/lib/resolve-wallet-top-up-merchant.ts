import type { createAdminClient } from '@/lib/supabase/admin';

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

/**
 * Resolve a merchant for wallet top-up using id-first, slug-fallback.
 *
 * Mobile wallet clients now send BOTH merchantId and merchantSlug. A stale
 * merchantId must not hard-fail the request when a valid merchantSlug is
 * present, so we try the id first and fall back to the slug instead of
 * committing to a single lookup column.
 */
export async function resolveWalletTopUpMerchant<T>(
  supabase: AdminSupabaseClient,
  identifiers: { merchantId?: string; merchantSlug?: string },
  columns: string
): Promise<T | null> {
  if (identifiers.merchantId) {
    const { data } = await supabase
      .from('merchants')
      .select(columns)
      .eq('id', identifiers.merchantId)
      .maybeSingle();
    if (data) {
      return data as T;
    }
  }

  if (identifiers.merchantSlug) {
    const { data } = await supabase
      .from('merchants')
      .select(columns)
      .eq('slug', identifiers.merchantSlug)
      .maybeSingle();
    if (data) {
      return data as T;
    }
  }

  return null;
}
