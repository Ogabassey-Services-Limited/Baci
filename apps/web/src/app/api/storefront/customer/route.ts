import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveMerchantIdBySlugOrAlias } from '@/lib/resolve-merchant-by-slug';
import { createClient } from '@/lib/supabase/server';
import { dateOfBirthSchema } from '@/schemas/customer-date-of-birth';

/**
 * Customer Profile API
 *
 * PATCH - Update customer profile
 */

const savedAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  full_name: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
  postal_code: z.string().optional(),
  is_default: z.boolean().optional(),
});

const patchBodySchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  date_of_birth: dateOfBirthSchema.optional(),
  saved_addresses: z.array(savedAddressSchema).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    // 1. Auth check FIRST
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate body
    // CSRF: handled by Origin-based middleware in proxy.ts (guest storefront route)
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const parseResult = patchBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parseResult.error) },
        { status: 400 }
      );
    }

    const {
      merchantSlug,
      first_name,
      last_name,
      phone,
      date_of_birth,
      saved_addresses,
    } = parseResult.data;

    // 3. Get merchant (alias-aware: a stale client on a just-renamed store passes
    // the retired slug in the body, which the proxy can't rewrite — resolve it via
    // the alias table so the request still targets the current merchant).
    const { merchantId, error: merchantError } =
      await resolveMerchantIdBySlugOrAlias(supabase, merchantSlug);

    if (merchantError || !merchantId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Get customer record for this merchant
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('merchant_id', merchantId)
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

    if (date_of_birth !== undefined) {
      updateData.date_of_birth = date_of_birth;
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
