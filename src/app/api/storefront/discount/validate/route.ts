'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

interface ValidationRequest {
  merchant_id: string;
  code: string;
  cart_total: number;
}

/**
 * POST /api/storefront/discount/validate
 * Validates a discount code for storefront customers
 * Uses service role to bypass RLS for anonymous users
 */
export async function POST(request: NextRequest) {
  try {
    const body: ValidationRequest = await request.json();
    const { merchant_id, code, cart_total } = body;

    if (!code || !merchant_id || cart_total === undefined) {
      return NextResponse.json(
        { valid: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for anonymous storefront users
    const supabase = createServiceClient();

    // Get discount code
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('merchant_id', merchant_id)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

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
      discountCode.usage_limit &&
      discountCode.usage_count >= discountCode.usage_limit
    ) {
      return NextResponse.json(
        { valid: false, error: 'Discount code usage limit reached' },
        { status: 200 }
      );
    }

    // Check minimum purchase amount
    if (
      discountCode.minimum_purchase_amount &&
      cart_total < discountCode.minimum_purchase_amount
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: `Minimum purchase of ₦${Number(discountCode.minimum_purchase_amount).toLocaleString()} required`,
        },
        { status: 200 }
      );
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.discount_type === 'percentage') {
      discountAmount = (cart_total * discountCode.discount_value) / 100;
    } else {
      discountAmount = Number(discountCode.discount_value);
    }

    // Apply maximum discount amount if set
    if (
      discountCode.maximum_discount_amount &&
      discountAmount > discountCode.maximum_discount_amount
    ) {
      discountAmount = Number(discountCode.maximum_discount_amount);
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
    console.error('Error validating discount code:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
