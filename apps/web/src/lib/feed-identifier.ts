import { getCurrentSlugForAlias } from '@/lib/slug-alias-cache';
import { createAnonClient } from '@/lib/supabase/anon';

/** Merchant record shape returned by feed identifier resolution. */
export interface FeedMerchantRecord {
  id: string;
  business_name: string;
  country: string;
  gmc_variants_enabled?: boolean;
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

  const lookup = async (
    id: string
  ): Promise<FeedMerchantRecord | undefined> => {
    const { data, error } = await supabase.rpc('resolve_public_feed_merchant', {
      p_identifier: id,
      p_is_by_slug: isBySlug,
    });
    if (error) {
      throw new Error('Failed to resolve merchant', { cause: error });
    }
    return (data as FeedMerchantRecord[] | null)?.[0];
  };

  let merchant = await lookup(identifier);

  // Retired-slug fallback: a feed URL built from a host the store renamed away
  // from (e.g. old.usebaci.com/api/feed/...) still carries the retired slug.
  // Resolve it to the current slug via the alias table and retry.
  if (!merchant && isBySlug) {
    const currentSlug = await getCurrentSlugForAlias(
      identifier.trim().toLowerCase()
    );
    if (currentSlug && currentSlug !== identifier.trim().toLowerCase()) {
      merchant = await lookup(currentSlug);
    }
  }

  if (!merchant) {
    throw new MerchantNotFoundError(identifier);
  }

  return merchant;
}
