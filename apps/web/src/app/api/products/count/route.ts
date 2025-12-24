import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const merchantId = searchParams.get('merchant_id');

  if (!merchantId) {
    return NextResponse.json(
      { error: 'Missing merchant_id parameter' },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: count, error } = await supabase.rpc(
      'get_merchant_product_count',
      {
        merchant_id_param: merchantId,
      }
    );

    if (error) throw error;

    // Determine recommended search method based on count
    const THRESHOLD = 500;
    const recommendedMethod = (count || 0) > THRESHOLD ? 'server' : 'client';

    return NextResponse.json({
      count: count || 0,
      recommendedMethod,
      threshold: THRESHOLD,
    });
  } catch (error) {
    console.error('Product count error:', error);
    return NextResponse.json(
      { error: 'Failed to get product count' },
      { status: 500 }
    );
  }
}
