import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * GET /api/wishlist?email=customer@example.com
 * Get wish list items for a customer
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('email');

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get wish list items with product details
    const { data: wishListItems, error } = await supabase
      .from('wish_list_items')
      .select(`
        id,
        created_at,
        product_id,
        products (
          id,
          name,
          slug,
          description,
          price,
          images,
          stock_quantity,
          status,
          category
        )
      `)
      .eq('customer_email', customerEmail)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ items: wishListItems || [] });
  } catch (error) {
    console.error('Error fetching wish list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wishlist
 * Add item to wish list
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerEmail, productId, merchantId } = body;

    if (!customerEmail || !productId || !merchantId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Add to wish list
    const { data: wishListItem, error } = await supabase
      .from('wish_list_items')
      .insert({
        customer_email: customerEmail,
        product_id: productId,
        merchant_id: merchantId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Item already in wish list' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ item: wishListItem }, { status: 201 });
  } catch (error) {
    console.error('Error adding to wish list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wishlist?id=uuid
 * Remove item from wish list
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase
      .from('wish_list_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Item removed from wish list' });
  } catch (error) {
    console.error('Error removing from wish list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
