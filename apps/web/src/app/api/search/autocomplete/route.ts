import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { isValidUuid, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

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

    // Use shared autocomplete function for normalized prefix/fuzzy matching.
    const { data: productSuggestions, error } = await supabase.rpc(
      'product_autocomplete_v2',
      {
        search_prefix: query,
        merchant_id_param: merchantId,
        result_limit: limit,
      }
    );

    if (error) throw error;

    // Popular searches disabled — search_analytics table has no data and
    // the popular_searches view caused 16K+ sequential scans per day via
    // RLS policy evaluation on every autocomplete keystroke.
    return NextResponse.json({
      suggestions: productSuggestions || [],
      popularSearches: [],
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    return NextResponse.json(
      { error: 'Failed to get autocomplete suggestions' },
      { status: 500 }
    );
  }
}
