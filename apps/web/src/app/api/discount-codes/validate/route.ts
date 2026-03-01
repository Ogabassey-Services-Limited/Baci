import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ValidationRequest {
  code: string;
  merchantId: string;
  customerEmail?: string;
  orderTotal: number;
  productIds?: string[];
  categoryIds?: string[];
}

/**
 * POST /api/discount-codes/validate
 * Validate a discount code and calculate discount amount
 */
export async function POST(request: NextRequest) {
  try {
    const body: ValidationRequest = await request.json();
    const {
      code,
      merchantId,
      customerEmail,
      orderTotal,
      productIds = [],
      categoryIds = [],
    } = body;

    if (!code || !merchantId || orderTotal === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get discount code
    const { data: discountCode, error } = await supabase
      .from('discount_codes')
      .select(
        'id, code, description, discount_type, discount_value, starts_at, expires_at, usage_limit, usage_count, usage_limit_per_customer, minimum_purchase_amount, applies_to, product_ids, category_ids, maximum_discount_amount'
      )
      .eq('merchant_id', merchantId)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !discountCode) {
      return NextResponse.json(
        { valid: false, error: 'Invalid discount code' },
        { status: 400 }
      );
    }

    // Check if code has started
    if (
      discountCode.starts_at &&
      new Date(discountCode.starts_at) > new Date()
    ) {
      return NextResponse.json(
        { valid: false, error: 'Discount code is not yet active' },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (
      discountCode.expires_at &&
      new Date(discountCode.expires_at) < new Date()
    ) {
      return NextResponse.json(
        { valid: false, error: 'Discount code has expired' },
        { status: 400 }
      );
    }

    // Check usage limit
    if (
      discountCode.usage_limit &&
      discountCode.usage_count >= discountCode.usage_limit
    ) {
      return NextResponse.json(
        { valid: false, error: 'Discount code usage limit reached' },
        { status: 400 }
      );
    }

    // Check per-customer usage limit
    if (customerEmail) {
      const { count } = await supabase
        .from('discount_code_usage')
        .select('discount_code_id', { count: 'exact', head: true })
        .eq('discount_code_id', discountCode.id)
        .eq('customer_email', customerEmail);

      if (count && count >= (discountCode.usage_limit_per_customer || 1)) {
        return NextResponse.json(
          { valid: false, error: 'You have already used this discount code' },
          { status: 400 }
        );
      }
    }

    // Check minimum purchase amount
    if (
      discountCode.minimum_purchase_amount &&
      orderTotal < discountCode.minimum_purchase_amount
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: `Minimum purchase amount of $${discountCode.minimum_purchase_amount} required`,
        },
        { status: 400 }
      );
    }

    // Check if applies to specific products/categories
    if (discountCode.applies_to === 'specific_products') {
      const codeProductIds = discountCode.product_ids as string[];
      const hasMatchingProduct = productIds.some((id) =>
        codeProductIds.includes(id)
      );
      if (!hasMatchingProduct) {
        return NextResponse.json(
          {
            valid: false,
            error: 'Discount code does not apply to items in your cart',
          },
          { status: 400 }
        );
      }
    }

    if (discountCode.applies_to === 'specific_categories') {
      const codeCategoryIds = discountCode.category_ids as string[];
      const hasMatchingCategory = categoryIds.some((id) =>
        codeCategoryIds.includes(id)
      );
      if (!hasMatchingCategory) {
        return NextResponse.json(
          {
            valid: false,
            error: 'Discount code does not apply to items in your cart',
          },
          { status: 400 }
        );
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.discount_type === 'percentage') {
      discountAmount = (orderTotal * discountCode.discount_value) / 100;
    } else {
      discountAmount = discountCode.discount_value;
    }

    // Apply maximum discount amount if set
    if (
      discountCode.maximum_discount_amount &&
      discountAmount > discountCode.maximum_discount_amount
    ) {
      discountAmount = discountCode.maximum_discount_amount;
    }

    // Ensure discount doesn't exceed order total
    discountAmount = Math.min(discountAmount, orderTotal);

    return NextResponse.json({
      valid: true,
      discountCode: {
        id: discountCode.id,
        code: discountCode.code,
        description: discountCode.description,
        discount_type: discountCode.discount_type,
        discount_value: discountCode.discount_value,
      },
      discountAmount,
      finalTotal: orderTotal - discountAmount,
    });
  } catch (error) {
    console.error('Error validating discount code:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
