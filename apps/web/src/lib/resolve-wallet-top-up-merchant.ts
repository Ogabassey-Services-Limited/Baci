import type { createAdminClient } from '@/lib/supabase/admin';

type AdminSupabaseClient = ReturnType<typeof createAdminClient>;

function selectColumnsWithSlug(columns: string) {
  const selectedColumns = columns
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);

  if (selectedColumns.includes('slug')) {
    return columns;
  }

  return `${columns}, slug`;
}

function getResolvedSlug(row: unknown) {
  if (!row || typeof row !== 'object' || !('slug' in row)) {
    return null;
  }

  const slug = (row as { slug?: unknown }).slug;
  return typeof slug === 'string' ? slug : null;
}

/**
 * Resolve a merchant for wallet top-up using id-first, slug-fallback.
 *
 * If both identifiers are present, the id match is accepted only when its slug
 * agrees with merchantSlug. A stale-but-existing id then falls back to the slug
 * merchant instead of moving the top-up into the wrong storefront context.
 */
export async function resolveWalletTopUpMerchant<T>(
  supabase: AdminSupabaseClient,
  identifiers: { merchantId?: string; merchantSlug?: string },
  columns: string
): Promise<T | null> {
  if (identifiers.merchantId) {
    const { data } = await supabase
      .from('merchants')
      .select(
        identifiers.merchantSlug ? selectColumnsWithSlug(columns) : columns
      )
      .eq('id', identifiers.merchantId)
      .maybeSingle();
    if (data) {
      if (
        !identifiers.merchantSlug ||
        getResolvedSlug(data) === identifiers.merchantSlug
      ) {
        return data as T;
      }
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
