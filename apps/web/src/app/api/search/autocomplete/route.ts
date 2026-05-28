import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  isValidUuid,
  sanitizeLikePattern,
  sanitizeSearchQuery,
} from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

const POSTGRES_QUERY_CANCELED_CODE = '57014';
const AUTOCOMPLETE_PRODUCT_SELECT = 'id, name, category, price, images, slug';

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get('q');
  const merchantId = searchParams.get('merchant_id');
  const rawLimit = searchParams.get('limit');
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 10;
  const limit = Number.isNaN(parsedLimit)
    ? 10
    : Math.min(100, Math.max(1, parsedLimit));

  if (!rawQuery || !merchantId) {
    return NextResponse.json(
      { error: 'Missing query or merchant_id parameter' },
      { status: 400 }
    );
  }

  // Validate merchantId
  if (!isValidUuid(merchantId)) {
    return NextResponse.json(
      { error: 'Invalid merchant_id format' },
      { status: 400 }
    );
  }

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

    const { data, error } = await supabase
      .from('products')
      .select(AUTOCOMPLETE_PRODUCT_SELECT)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .or(
        [
          `name.ilike.%${likeQuery}%`,
          `brand.ilike.%${likeQuery}%`,
          `category.ilike.%${likeQuery}%`,
          `sku.ilike.%${likeQuery}%`,
        ].join(',')
      )
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const productSuggestions = (Array.isArray(data) ? data : []).map((row) => {
      const product = row as AutocompleteProductRow;

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        image_small: getImageSmall(product.images),
        slug: product.slug,
        relevance: 1,
      };
    });

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
