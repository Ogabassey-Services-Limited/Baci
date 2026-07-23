import type { SupabaseClient } from '@supabase/supabase-js';
import { withMerchantSlugAliasFallback } from '@/lib/with-merchant-slug-alias-fallback';

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

function getLookupErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return 'Unknown Supabase error';
}

function throwLookupError({
  error,
  identifier,
  value,
}: {
  error: unknown;
  identifier: 'merchantId' | 'merchantSlug';
  value: string;
}): never {
  throw new Error(
    `resolveWalletTopUpMerchant ${identifier} lookup failed for ${value}: ${getLookupErrorMessage(error)}`
  );
}

/**
 * Resolve a merchant for wallet top-up using id-first, slug-fallback.
 *
 * If both identifiers are present, the id match is accepted only when its slug
 * agrees with merchantSlug. A valid slug then wins over a stale-but-existing
 * id, while a valid id can still recover when the slug is stale or unavailable.
 */
/**
 * Resolve a merchant by id-first / slug-fallback. The CALLER chooses the client
 * to match the columns it selects: pass the authenticated (RLS) client when
 * selecting only non-secret identity columns (so unpublished merchants the caller
 * cannot access stay invisible — no tenant existence oracle), and the service-
 * role client only when the caller genuinely needs revoked secret columns AND has
 * already established a trusted tenant context.
 */
export async function resolveWalletTopUpMerchant<T>(
  supabase: SupabaseClient,
  identifiers: { merchantId?: string; merchantSlug?: string },
  columns: string
): Promise<T | null> {
  let idMatch: T | null = null;

  if (identifiers.merchantId) {
    const { data, error } = await supabase
      .from('merchants')
      .select(
        identifiers.merchantSlug ? selectColumnsWithSlug(columns) : columns
      )
      .eq('id', identifiers.merchantId)
      .maybeSingle();
    if (error) {
      throwLookupError({
        error,
        identifier: 'merchantId',
        value: identifiers.merchantId,
      });
    }
    if (data) {
      if (
        !identifiers.merchantSlug ||
        getResolvedSlug(data) === identifiers.merchantSlug
      ) {
        return data as T;
      }
      idMatch = data as T;
    }
  }

  if (identifiers.merchantSlug) {
    // Alias-aware: the slug can arrive stale in a request body after a "Change
    // store URL" rename (the proxy can't rewrite bodies), so fall back to
    // merchant_slug_aliases before giving up.
    const { data, error } = await withMerchantSlugAliasFallback(
      identifiers.merchantSlug,
      (s) =>
        supabase.from('merchants').select(columns).eq('slug', s).maybeSingle()
    );
    if (error) {
      throwLookupError({
        error,
        identifier: 'merchantSlug',
        value: identifiers.merchantSlug,
      });
    }
    if (data) {
      return data as T;
    }
  }

  return idMatch;
}
