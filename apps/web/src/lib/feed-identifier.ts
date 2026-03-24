import { createAnonClient } from '@/lib/supabase/anon';

/** Merchant record shape returned by feed identifier resolution. */
export interface FeedMerchantRecord {
  id: string;
  business_name: string;
  country: string;
  payout_currency: string;
  slug: string;
}

/** Thrown when a merchant lookup returns no rows. */
export class MerchantNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Merchant not found: ${identifier}`);
    this.name = 'MerchantNotFoundError';
  }
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
 * @throws {MerchantNotFoundError} when no merchant matches the identifier
 * @throws {Error} 'Failed to resolve merchant' on DB/query errors
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

  if (error) {
    throw new Error('Failed to resolve merchant', { cause: error });
  }

  if (!merchant) {
    throw new MerchantNotFoundError(identifier);
  }

  return merchant as FeedMerchantRecord;
}
