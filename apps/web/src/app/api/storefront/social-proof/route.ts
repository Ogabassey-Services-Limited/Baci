import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Social Proof API
 *
 * GET - Returns social proof data for a product (recent sales, purchases, trending status)
 *
 * Query params:
 * - productId: string (required)
 * - merchantId: string (required)
 */

const socialProofStatsSchema = z.object({
  weekSales: z.number().nullable(),
  dailySales: z.number().nullable(),
  recentPurchases: z.array(
    z.object({
      city: z.string().nullable(),
      created_at: z.string(),
      product_name: z.string(),
    })
  ),
});

// Nigerian cities for anonymized display
const NIGERIAN_CITIES = [
  'Lagos',
  'Abuja',
  'Port Harcourt',
  'Ibadan',
  'Kano',
  'Benin City',
  'Enugu',
  'Kaduna',
  'Warri',
  'Ilorin',
  'Jos',
  'Owerri',
  'Calabar',
  'Uyo',
  'Abeokuta',
  'Onitsha',
  'Aba',
  'Zaria',
  'Maiduguri',
  'Akure',
];

function _getRandomCity(): string {
  return NIGERIAN_CITIES[Math.floor(Math.random() * NIGERIAN_CITIES.length)];
}

function _formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
  return 'recently';
}

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
      recentPurchases: proofStats.recentPurchases || [],
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
