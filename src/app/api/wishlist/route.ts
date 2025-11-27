import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Retrieve wish list items for a customer identified by the `email` query parameter.
 *
 * Reads the `email` search parameter from the request URL and returns the customer's wish list
 * entries, each including its `id`, `created_at`, `product_id`, and a nested `products` object
 * with product details (id, name, slug, description, price, images, stock_quantity, status, category).
 * Responds with an empty `items` array when no entries exist. Returns a 400 status if `email` is missing
 * and a 500 status on internal errors.
 *
 * @param request - Incoming NextRequest; must include the `email` query parameter (e.g., ?email=user@example.com)
 * @returns An object `{ items: Array }` where each array element is a wish list entry with the nested `products` details
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
 * Create a wish list entry for a customer.
 *
 * Expects the request body to be JSON with `customerEmail`, `productId`, and `merchantId`.
 * Responds with 400 when required fields are missing, 409 when the item already exists, and 500 on server error.
 *
 * @param request - The incoming NextRequest whose JSON body must include `customerEmail`, `productId`, and `merchantId`
 * @returns The created wish list item object
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
 * Remove a wish list item identified by the `id` query parameter.
 *
 * Expects an `id` query parameter and deletes the corresponding `wish_list_items` row.
 *
 * @returns `200` with `{ message: 'Item removed from wish list' }` on success; `400` with `{ error: 'Item ID is required' }` if `id` is missing; `500` with `{ error: 'Internal server error' }` on failure.
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