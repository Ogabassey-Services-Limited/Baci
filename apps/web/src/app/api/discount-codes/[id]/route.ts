import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { updateDiscountCodeSchema } from '@/schemas/discount-codes';

const DISCOUNT_CODE_COLUMNS =
  'id, code, description, discount_type, discount_value, minimum_purchase_amount, maximum_discount_amount, usage_limit, usage_limit_per_customer, usage_count, starts_at, expires_at, is_active, applies_to, product_ids, category_ids, created_at, updated_at';

const idParamSchema = z.uuid();

/**
 * PATCH /api/discount-codes/[id]
 * Update a discount code
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!idParamSchema.safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid discount code ID' },
        { status: 400 }
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate update fields
    const parseResult = updateDiscountCodeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid update data',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // Empty PATCH is a no-op (idempotent) — return current state
    if (Object.keys(updateData).length === 0) {
      const { data: discountCode, error } = await supabase
        .from('discount_codes')
        .select(DISCOUNT_CODE_COLUMNS)
        .eq('id', id)
        .eq('merchant_id', merchantId)
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
    }

    // Update discount code (Scope to merchant ID for defense-in-depth)
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .update(updateData)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select(DISCOUNT_CODE_COLUMNS)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Discount code not found' },
          { status: 404 }
        );
      }
      // A used code's identity is immutable (DB trigger) so retries can still
      // resolve the original code string.
      if (error.message?.includes('discount_code_rename_not_allowed')) {
        return NextResponse.json(
          {
            code: 'discount_code_rename_not_allowed',
            error:
              'This code has already been used and cannot be renamed. Deactivate it and create a new code instead.',
          },
          { status: 409 }
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
 * DELETE /api/discount-codes/[id]
 * Delete a discount code
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!idParamSchema.safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid discount code ID' },
        { status: 400 }
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'marketing', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Delete discount code (Scope to merchant ID for defense-in-depth)
    const { error } = await supabase
      .from('discount_codes')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (error) {
      // A USED code cannot be hard-deleted (DB trigger / usage FK RESTRICT).
      // Deactivate it instead so usage history + audit links survive.
      if (
        error.code === '23503' ||
        error.message?.includes('discount_code_delete_not_allowed')
      ) {
        const { error: deactivateError } = await supabase
          .from('discount_codes')
          .update({ is_active: false })
          .eq('id', id)
          .eq('merchant_id', merchantId)
          .select('id')
          .single();

        if (deactivateError) {
          throw deactivateError;
        }

        return NextResponse.json({ success: true, deactivated: true });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting discount code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
