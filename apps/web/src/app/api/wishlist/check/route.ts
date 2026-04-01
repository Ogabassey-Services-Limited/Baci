import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Hash a session token for privacy (don't store raw tokens)
 */
function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validate UUID format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * GET /api/wishlist/check?productId=uuid&session=xxx
 * Check if a product is in authenticated user's or guest's wish list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const sessionToken = searchParams.get('session');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Validate UUID format
    if (!isValidUUID(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID format' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check for authenticated user first
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let customerIdentifier: string;

    if (user?.email) {
      // Authenticated user - use their email
      customerIdentifier = user.email;
    } else if (sessionToken && sessionToken.length >= 16) {
      // Guest user - use hashed session token as identifier
      customerIdentifier = `guest:${hashSessionToken(sessionToken)}`;
    } else {
      // No auth and no session - return not in wishlist (don't expose error)
      return NextResponse.json({ inWishList: false, itemId: null });
    }

    const { data, error } = await supabase
      .from('wish_list_items')
      .select('id')
      .eq('customer_email', customerIdentifier)
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's expected when item isn't in list
      console.error('Error checking wish list:', {
        message: error.message,
        code: error.code,
      });
      throw error;
    }

    return NextResponse.json({ inWishList: !!data, itemId: data?.id || null });
  } catch (error) {
    console.error('Error checking wish list:', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
