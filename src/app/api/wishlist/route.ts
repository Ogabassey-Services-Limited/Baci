import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Retrieve wish list items (including related product details) for the specified customer email.
 *
 * @returns On success, an object with an `items` array of wish list entries where each entry includes embedded product fields; if the `email` query parameter is missing, an error object with status 400; on internal failure, an error object with status 500.
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
 * Create a new wish list item for a customer.
 *
 * Attempts to insert a wish_list_items row for the provided `customerEmail`, `productId`, and `merchantId`.
 *
 * @returns JSON with the created item on success (status 201). Returns a 400 JSON error when required fields are missing, 409 when the item already exists (unique violation), or 500 for internal server errors.
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
 * Remove a wish list item by its ID.
 *
 * @returns A JSON response: on success `{ message: 'Item removed from wish list' }`;
 * on missing `id` returns status 400 with `{ error: 'Item ID is required' }`;
 * on server error returns status 500 with `{ error: 'Internal server error' }`.
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