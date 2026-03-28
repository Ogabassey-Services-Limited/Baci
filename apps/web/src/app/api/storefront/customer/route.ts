import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer Profile API
 *
 * PATCH - Update customer profile
 */

const patchCustomerSchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  saved_addresses: z.array(z.record(z.unknown())).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    // CSRF: handled by Origin-based middleware in proxy.ts (guest storefront route)
    const body = await request.json();
    const result = patchCustomerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { merchantSlug, first_name, last_name, phone, saved_addresses } =
      result.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get current auth session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Get customer record for this merchant
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('user_id', user.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (first_name !== undefined) {
      updateData.first_name = first_name;
    }

    if (last_name !== undefined) {
      updateData.last_name = last_name;
    }

    if (phone !== undefined) {
      updateData.phone = phone;
    }

    if (saved_addresses !== undefined) {
      updateData.saved_addresses = saved_addresses;
    }

    // Update customer
    const { error: updateError } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customer.id);

    if (updateError) {
      console.error('Customer update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Customer update API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
