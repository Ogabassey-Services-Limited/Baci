import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { cache } from '@/lib/cache';

/**
 * Invalidates analytics and AI-insights cache entries for the authenticated merchant.
 *
 * Authenticates the request, resolves the merchant associated with the current user, and deletes cache entries scoped to that merchant.
 *
 * @returns On success, a JSON object with `message` and `merchantId`. On failure, a JSON error object with an appropriate HTTP status: `401` (unauthorized), `404` (merchant not found), or `500` (internal server error).
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
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
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
 * Provide basic cache statistics for debugging.
 *
 * @returns A JSON object with `size` — current cache size, and `message` — an informational note recommending Redis for production deployments.
 */
export async function GET() {
  try {
    return NextResponse.json({
      size: cache.size(),
      message: 'Cache is running with in-memory storage. For production, consider Redis.',
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}