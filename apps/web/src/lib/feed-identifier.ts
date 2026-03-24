import { createAnonClient } from '@/lib/supabase/anon';

/** Merchant record shape returned by feed identifier resolution. */
export interface FeedMerchantRecord {
  id: string;
  business_name: string;
  country: string;
  payout_currency: string;
  slug: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lightweight UUID v4-style check (format only, not version bits). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Resolve a merchant identifier (slug or UUID) to a merchant record.
 * Uses the stateless anon client — safe for cached/public contexts.
 *
 * @throws {Error} 'Merchant not found' if lookup fails
 */
export async function resolveFeedMerchant(
  identifier: string,
  isBySlug: boolean
): Promise<FeedMerchantRecord> {
  const supabase = createAnonClient();
  const query = supabase
    .from('merchants')
    .select('id, business_name, country, payout_currency, slug');

  const { data: merchant, error } = isBySlug
    ? await query.eq('slug', identifier).single()
    : await query.eq('id', identifier).single();

  if (error || !merchant) {
    throw new Error('Merchant not found', { cause: error });
  }

  return merchant as FeedMerchantRecord;
}
