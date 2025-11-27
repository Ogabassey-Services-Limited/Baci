import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Determine whether the specified product is in the given customer's wish list.
 *
 * @param request - The incoming request whose URL query must include `email` (customer email) and `productId` (product UUID)
 * @returns A JSON object with `inWishList`: `true` if a matching wish list item exists, `false` otherwise, and `itemId`: the item's `id` when present or `null`
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');
    const productId = searchParams.get('productId');

    if (!customerEmail || !productId) {
      return NextResponse.json(
        { error: 'Customer email and product ID are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from('wish_list_items')
      .select('id')
      .eq('customer_email', customerEmail)
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({ inWishList: !!data, itemId: data?.id || null });
  } catch (error) {
    console.error('Error checking wish list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}