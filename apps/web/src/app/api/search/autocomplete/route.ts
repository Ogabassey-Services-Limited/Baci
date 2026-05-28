import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

const POSTGRES_QUERY_CANCELED_CODE = '57014';
const AUTOCOMPLETE_PRODUCT_SELECT = 'id, name, category, price, images, slug';
const AUTOCOMPLETE_SEARCH_COLUMNS = [
  'name',
  'brand',
  'category',
  'sku',
] as const;
const AutocompleteQuerySchema = z.object({
  q: z.string().trim().min(1),
  merchant_id: z.string().uuid(),
  limit: z.preprocess(
    (value) =>
      value === undefined || value === null || value === '' ? 10 : value,
    z.coerce.number().int().min(1).max(100)
  ),
});

type AutocompleteSearchColumn = (typeof AUTOCOMPLETE_SEARCH_COLUMNS)[number];
type SupabaseClient = ReturnType<typeof createClient>;

interface AutocompleteProductRow {
  id: string;
  name: string;
  category: string | null;
  price: number | string | null;
  images: unknown;
  slug: string | null;
}

function getImageSmall(images: unknown): string | null {
  if (!Array.isArray(images)) return null;

  const [firstImage] = images;
  return typeof firstImage === 'string' ? firstImage : null;
}

async function fetchProductAutocompleteRows(
  supabase: SupabaseClient,
  merchantId: string,
  likeQuery: string,
  limit: number
): Promise<AutocompleteProductRow[]> {
  const rowsById = new Map<string, AutocompleteProductRow>();

  for (const column of AUTOCOMPLETE_SEARCH_COLUMNS) {
    if (rowsById.size >= limit) break;

    const { data, error } = await supabase
      .from('products')
      .select(AUTOCOMPLETE_PRODUCT_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .ilike(column satisfies AutocompleteSearchColumn, `%${likeQuery}%`)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    for (const row of Array.isArray(data) ? data : []) {
      const product = row as AutocompleteProductRow;
      if (!rowsById.has(product.id)) rowsById.set(product.id, product);
      if (rowsById.size >= limit) break;
    }
  }

  return [...rowsById.values()];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawParams = {
    q: searchParams.get('q') ?? undefined,
    merchant_id: searchParams.get('merchant_id') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  };

  const parsedParams = AutocompleteQuerySchema.safeParse(rawParams);
  if (!parsedParams.success) {
    const fieldErrors = parsedParams.error.flatten().fieldErrors;
    if (fieldErrors.q || (fieldErrors.merchant_id && !rawParams.merchant_id)) {
      return NextResponse.json(
        { error: 'Missing query or merchant_id parameter' },
        { status: 400 }
      );
    }

    if (fieldErrors.merchant_id) {
      return NextResponse.json(
        { error: 'Invalid merchant_id format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid autocomplete parameters' },
      { status: 400 }
    );
  }

  const { q: rawQuery, merchant_id: merchantId, limit } = parsedParams.data;

  // Sanitize search query
  const query = sanitizeSearchQuery(rawQuery);

  // Don't autocomplete very short queries
  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const likeQuery = sanitizeLikePattern(query);

    const autocompleteRows = await fetchProductAutocompleteRows(
      supabase,
      merchantId,
      likeQuery,
      limit
    );

    const productSuggestions = autocompleteRows.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      image_small: getImageSmall(product.images),
      slug: product.slug,
      relevance: 1,
    }));

    // Popular searches disabled — search_analytics table has no data and
    // the popular_searches view caused 16K+ sequential scans per day via
    // RLS policy evaluation on every autocomplete keystroke.
    return NextResponse.json({
      suggestions: productSuggestions || [],
      popularSearches: [],
    });
  } catch (error) {
    const errorCode =
      typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : '';

    if (errorCode === POSTGRES_QUERY_CANCELED_CODE) {
      console.warn(
        'Autocomplete timed out; returning empty suggestions for this request'
      );
      return NextResponse.json({
        suggestions: [],
        popularSearches: [],
      });
    }

    console.error('Autocomplete error:', error);
    return NextResponse.json(
      { error: 'Failed to get autocomplete suggestions' },
      { status: 500 }
    );
  }
}
