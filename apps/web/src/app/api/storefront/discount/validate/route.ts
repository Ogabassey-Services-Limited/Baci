import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createAnonClient } from '@/lib/supabase/anon';
import {
  storefrontDiscountCodeRowSchema,
  storefrontDiscountValidateSchema,
} from '@/schemas/storefront-discount';

/**
 * POST /api/storefront/discount/validate
 * Validates a discount code for storefront customers.
 * Uses anon client with a SECURITY DEFINER RPC for anonymous access.
 *
 * CSRF exemption: Called by anonymous storefront visitors during checkout.
 * Guest users do not have CSRF tokens. Abuse is mitigated by rate limiting
 * in proxy.ts and the RPC's read-only validation behavior.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { valid: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    const parsed = storefrontDiscountValidateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid input',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { merchant_id, code, cart_total } = parsed.data;

    const supabase = createAnonClient();

    const { data, error } = await supabase.rpc('get_storefront_discount_code', {
      p_merchant_id: merchant_id,
      p_code: code,
    });

    const parsedArray = storefrontDiscountCodeRowSchema.array().safeParse(data);
    const parsedSingle = parsedArray.success
      ? null
      : storefrontDiscountCodeRowSchema.safeParse(data);
    if (!parsedArray.success && !parsedSingle?.success) {
      return NextResponse.json(
        { valid: false, error: 'Invalid discount code' },
        { status: 200 }
      );
    }
    const discountCode = parsedArray.success
      ? (parsedArray.data[0] ?? null)
      : (parsedSingle?.data ?? null);

    if (error || !discountCode) {
      return NextResponse.json(
        { valid: false, error: 'Invalid discount code' },
        { status: 200 }
      );
    }

    // Check if code has started
    if (
      discountCode.starts_at &&
      new Date(discountCode.starts_at) > new Date()
    ) {
      return NextResponse.json(
        { valid: false, error: 'Discount code is not yet active' },
        { status: 200 }
      );
    }

    // Check if code has expired
    if (
      discountCode.expires_at &&
      new Date(discountCode.expires_at) < new Date()
    ) {
      return NextResponse.json(
        { valid: false, error: 'Discount code has expired' },
        { status: 200 }
      );
    }

    // Check usage limit
    if (
      discountCode.usage_limit != null &&
      discountCode.usage_count >= discountCode.usage_limit
    ) {
      return NextResponse.json(
        { valid: false, error: 'Discount code usage limit reached' },
        { status: 200 }
      );
    }

    // Check minimum purchase amount
    if (
      discountCode.minimum_purchase_amount != null &&
      cart_total < Number(discountCode.minimum_purchase_amount)
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: `Minimum purchase of ₦${Number(discountCode.minimum_purchase_amount).toLocaleString()} required`,
        },
        { status: 200 }
      );
    }

    // Calculate discount amount (rounded to avoid floating point errors)
    let discountAmount = 0;
    if (discountCode.discount_type === 'percentage') {
      discountAmount = Math.round(
        (cart_total * Number(discountCode.discount_value)) / 100
      );
    } else {
      discountAmount = Math.round(Number(discountCode.discount_value));
    }

    // Apply maximum discount amount if set (use != null to honor 0)
    if (
      discountCode.maximum_discount_amount != null &&
      discountAmount > Math.round(Number(discountCode.maximum_discount_amount))
    ) {
      discountAmount = Math.round(Number(discountCode.maximum_discount_amount));
    }

    // Ensure discount doesn't exceed cart total
    discountAmount = Math.min(discountAmount, cart_total);

    return NextResponse.json({
      valid: true,
      discount_code_id: discountCode.id,
      code: discountCode.code,
      discount_type:
        discountCode.discount_type === 'fixed_amount' ? 'fixed' : 'percentage',
      discount_value: Number(discountCode.discount_value),
      discount_amount: discountAmount,
      minimum_order: discountCode.minimum_purchase_amount
        ? Number(discountCode.minimum_purchase_amount)
        : undefined,
      description: discountCode.description,
    });
  } catch (error) {
    logger.error({
      message: 'Error validating discount code',
      error: error instanceof Error ? error : 'Unknown error',
    });
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
