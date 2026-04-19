import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  InvalidMerchantIdError,
  searchStorefrontProducts,
} from '@/lib/storefront-search';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get('q');
  const merchantId = searchParams.get('merchant_id');
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10);

  if (!rawQuery || !merchantId) {
    return NextResponse.json(
      { error: 'Missing query or merchant_id parameter' },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const result = await searchStorefrontProducts({
      supabase,
      merchantId,
      query: rawQuery,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof InvalidMerchantIdError ? 400 : 500;

    return NextResponse.json(
      {
        error:
          status === 400
            ? 'Invalid merchant_id format'
            : 'Failed to perform search',
      },
      { status }
    );
  }
}
