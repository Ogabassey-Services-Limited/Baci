import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { cache } from '@/lib/cache';

/**
 * Invalidate analytics and AI-insights cache for the authenticated merchant.
 *
 * Returns a JSON response indicating success or an error status when authorization
 * or merchant lookup fails, or when an internal error occurs.
 *
 * @returns On success: an object with `message` and `merchantId`.
 * On failure: an error object and one of the HTTP statuses:
 * - `401` when the request is unauthorized (`{ error: 'Unauthorized' }`),
 * - `404` when the merchant is not found (`{ error: 'Merchant not found' }`),
 * - `500` for internal server errors (`{ error: 'Internal server error' }`).
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
 * Return basic cache statistics for debugging.
 *
 * @returns A JSON object with `size` (number of cached entries) and `message` (string). On failure returns a JSON error object `{ error: string }` with HTTP status 500.
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