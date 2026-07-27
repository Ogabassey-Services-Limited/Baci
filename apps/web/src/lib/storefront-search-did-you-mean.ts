import { logger } from './logger';
import type { StorefrontSearchSupabase } from './storefront-search';

export async function findStorefrontSearchDidYouMean({
  supabase,
  merchantId,
  query,
}: {
  supabase: StorefrontSearchSupabase;
  merchantId: string;
  query: string;
}): Promise<string | null> {
  try {
    const { data: suggestion, error } = await supabase.rpc(
      'find_product_search_suggestion_v2',
      {
        merchant_id_param: merchantId,
        search_term: query,
      }
    );

    if (error) {
      // "Did you mean" is strictly additive — a failed suggestion lookup must
      // not turn a valid zero-results search into a 500.
      logger.warn({
        message: 'Search suggestion lookup failed; returning no suggestion',
        error: error.message,
        merchantId,
        query,
      });
      return null;
    }

    if (!Array.isArray(suggestion) || suggestion.length === 0) {
      return null;
    }

    const firstSuggestion: unknown = suggestion[0];
    if (
      typeof firstSuggestion !== 'object' ||
      firstSuggestion === null ||
      !('suggested_term' in firstSuggestion) ||
      typeof firstSuggestion.suggested_term !== 'string'
    ) {
      return null;
    }

    return firstSuggestion.suggested_term;
  } catch (error) {
    logger.warn({
      message: 'Search suggestion lookup failed; returning no suggestion',
      error: error instanceof Error ? error.message : String(error),
      merchantId,
      query,
    });
    return null;
  }
}
