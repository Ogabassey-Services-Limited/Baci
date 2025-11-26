import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * GET /api/wishlist/check?email=customer@example.com&productId=uuid
 * Check if a product is in customer's wish list
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
