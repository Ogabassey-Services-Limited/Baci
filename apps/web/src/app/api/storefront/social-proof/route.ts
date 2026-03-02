import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { socialProofStatsSchema } from '@/schemas/social-proof';

/**
 * Social Proof API
 *
 * GET - Returns social proof data for a product (recent sales, purchases, trending status)
 *
 * Query params:
 * - productId: string (required)
 * - merchantId: string (required)
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const merchantId = searchParams.get('merchantId');

    if (!productId || !merchantId) {
      return NextResponse.json(
        { error: 'productId and merchantId are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // OPTIMIZED: Use RPC for social proof stats
    const { data: stats, error: statsError } = await supabase.rpc(
      'get_social_proof_stats',
      {
        p_product_id: productId,
        p_merchant_id: merchantId,
      }
    );

    if (statsError) throw statsError;

    const parsedStats = socialProofStatsSchema.safeParse(stats);
    if (!parsedStats.success) {
      console.error(
        'Invalid stats structure returned from RPC:',
        parsedStats.error
      );
      return NextResponse.json(
        { error: 'Invalid data format from database' },
        { status: 500 }
      );
    }
    const proofStats = parsedStats.data;

    return NextResponse.json({
      recentSales: Number(proofStats.dailySales) || 0,
      weekSales: Number(proofStats.weekSales) || 0,
      recentPurchases: proofStats.recentPurchases,
      trending: (Number(proofStats.weekSales) || 0) >= 5,
    });
  } catch (error) {
    console.error('Social proof API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
