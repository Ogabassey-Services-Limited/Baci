import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Update a discount code by id and return the updated record.
 *
 * Updates the discount_codes row identified by `params` -> `id`. Requires an authenticated user; the request body fields are merged into the updated row and, if `code` is provided, it is converted to uppercase before saving. Uses row-level security to restrict updates to the owner.
 *
 * @param request - Incoming NextRequest with the update payload as JSON
 * @param params - A promise resolving to an object with the `id` of the discount code to update
 * @returns A NextResponse containing `{ discountCode }` on success; on failure returns a JSON error message with one of: `401` (unauthorized), `404` (discount code not found), or `500` (internal server error)
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
 * Handle DELETE requests to remove a discount code by id.
 *
 * @param params - Route parameters object; `params.id` is the discount code identifier to delete
 * @returns `{ message: 'Discount code deleted successfully' }` on success; `{ error: 'Unauthorized' }` with status 401 if the request is unauthenticated; `{ error: 'Internal server error' }` with status 500 on unexpected failures
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