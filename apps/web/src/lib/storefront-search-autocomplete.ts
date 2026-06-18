import { getPrimaryProductImage } from './product-image';
import type { StorefrontSearchSupabase } from './storefront-search';
import { searchStorefrontProducts } from './storefront-search';

const AUTOCOMPLETE_PRODUCT_SELECT = 'id, name, category, price, images, slug';
const MAX_AUTOCOMPLETE_LIMIT = 100;

interface AutocompleteProductRow {
  id: string;
  name: string;
  category: string | null;
  price: number | string | null;
  images: unknown;
  slug: string | null;
}

interface AutocompleteProductQuery
  extends PromiseLike<{
    data: AutocompleteProductRow[] | null;
    error: unknown;
  }> {
  in: (column: string, values: string[]) => AutocompleteProductQuery;
  eq: (column: string, value: string) => AutocompleteProductQuery;
}

interface AutocompleteProductTable {
  select: (columns: string) => AutocompleteProductQuery;
}

export interface AutocompleteSupabase extends StorefrontSearchSupabase {
  from: (table: string) => AutocompleteProductTable;
}

export interface AutocompleteProductSuggestion {
  id: string;
  name: string;
  category: string | null;
  price: number | string | null;
  image_small: string | null;
  slug: string | null;
  relevance: number;
}

export interface AutocompleteResponse {
  suggestions: AutocompleteProductSuggestion[];
  popularSearches: Array<{ search_query: string; search_count: number }>;
}

function getImageSmall(images: unknown): string | null {
  // Catalog images may be plain string URLs or `{ url, alt, order }` objects;
  // reuse the shared resolver so autocomplete thumbnails match the storefront.
  return getPrimaryProductImage(
    images as Array<string | { url?: string | null }> | null | undefined
  );
}

export async function getStorefrontAutocompleteProducts({
  supabase,
  merchantId,
  query,
  limit,
}: {
  supabase: AutocompleteSupabase;
  merchantId: string;
  query: string;
  limit: number;
}): Promise<AutocompleteResponse> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return { suggestions: [], popularSearches: [] };
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_AUTOCOMPLETE_LIMIT) {
    throw new Error(`limit must be between 1 and ${MAX_AUTOCOMPLETE_LIMIT}`);
  }

  const ranked = await searchStorefrontProducts({
    supabase,
    merchantId,
    query: trimmedQuery,
    limit,
    trackAnalytics: false,
  });

  if (ranked.productIds.length === 0) {
    return { suggestions: [], popularSearches: [] };
  }

  const { data, error } = await supabase
    .from('products')
    .select(AUTOCOMPLETE_PRODUCT_SELECT)
    .in('id', ranked.productIds)
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  const order = new Map(
    ranked.productIds.map((id, index) => [id, index] as const)
  );
  const suggestions = (data ?? [])
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      image_small: getImageSmall(product.images),
      slug: product.slug,
      relevance: 1,
    }))
    .sort(
      (a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );

  return { suggestions, popularSearches: [] };
}
