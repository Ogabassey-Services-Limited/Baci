import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/analytics/cache
 * Invalidate analytics cache for the current merchant
 * Useful after creating orders, updating products, etc.
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Delete all cache entries for this merchant (using wildcards)
    cache.deletePattern(`analytics:${merchant.id}*`);
    cache.deletePattern(`ai-insights:${merchant.id}*`);

    return NextResponse.json({
      message: 'Cache invalidated successfully',
      merchantId: merchant.id,
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/cache
 * Get cache stats (for debugging)
 */
export function GET() {
  try {
    return NextResponse.json({
      size: cache.size(),
      message:
        'Cache is running with in-memory storage. For production, consider Redis.',
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
