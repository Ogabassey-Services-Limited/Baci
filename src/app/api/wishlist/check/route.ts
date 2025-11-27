import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Determine whether a product is present in a customer's wish list.
 *
 * @param request - NextRequest whose URL query must include `email` (customer email) and `productId` (product UUID)
 * @returns A JSON response: on success, `{ inWishList: boolean, itemId: string | null }`; on error, `{ error: string }` with status 400 for missing parameters or 500 for server errors.
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