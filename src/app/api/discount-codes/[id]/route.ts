import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Update a discount code by id for the authenticated user.
 *
 * @param request - Incoming request whose JSON body contains fields to update; if `code` is provided it will be converted to uppercase.
 * @param params - A promise resolving to an object with `id`, the discount code's identifier.
 * @returns JSON response: the updated `discountCode` on success; an `error` message with status `401`, `404`, or `500` on failure.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Update discount code (RLS will ensure it belongs to the merchant)
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .update({
        ...body,
        code: body.code ? body.code.toUpperCase() : undefined,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Discount code not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ discountCode });
  } catch (error) {
    console.error('Error updating discount code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Deletes the discount code identified by the route `id` for the authenticated user.
 *
 * Requires an authenticated Supabase user; ownership is enforced by Row-Level Security so only the merchant owning the code will have it deleted.
 *
 * @returns On success, a JSON object with `message: 'Discount code deleted successfully'`. If the request is unauthorized, a JSON error message is returned with HTTP status 401. On internal errors, a JSON error message is returned with HTTP status 500.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete discount code (RLS will ensure it belongs to the merchant)
    const { error } = await supabase
      .from('discount_codes')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Discount code deleted successfully' });
  } catch (error) {
    console.error('Error deleting discount code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}