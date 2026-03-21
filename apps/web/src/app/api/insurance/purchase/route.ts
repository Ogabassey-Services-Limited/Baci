import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  createMyCoverClient,
  type ItemDetail,
  MyCoverError,
  type PurchaseGITParams,
} from '@/lib/mycover';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface PurchaseInsuranceRequest {
  order_id: string;
  merchant_id: string;

  // Customer details
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };

  // Shipping details
  shipping: {
    pickup_address: string;
    delivery_address: string;
    shipping_date: string; // ISO date
    vehicle_type?:
      | 'Truck'
      | 'Car'
      | 'Bus'
      | 'Motorcycle'
      | 'Tricycle'
      | 'Air Plane';
  };

  // Order items to insure
  items: {
    name: string;
    value: number;
    quantity: number;
    image_url?: string;
  }[];

  // Total value to insure
  total_value: number;
}

/**
 * POST /api/insurance/purchase
 *
 * Purchase shipping insurance for an order.
 * Called during checkout when customer opts for shipping protection.
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const body: PurchaseInsuranceRequest = await request.json();

    // Validate required fields
    if (!body.order_id || !body.merchant_id) {
      return NextResponse.json(
        { error: 'order_id and merchant_id are required' },
        { status: 400 }
      );
    }

    if (!body.customer?.email || !body.customer?.phone) {
      return NextResponse.json(
        { error: 'Customer email and phone are required' },
        { status: 400 }
      );
    }

    if (!body.items?.length || body.total_value <= 0) {
      return NextResponse.json(
        { error: 'Items and total_value are required' },
        { status: 400 }
      );
    }

    // Initialize MyCover client
    const myCover = createMyCoverClient();
    if (!myCover) {
      return NextResponse.json(
        { error: 'Insurance service not configured' },
        { status: 503 }
      );
    }

    // Prepare item details for MyCover
    const itemDetails: ItemDetail[] = body.items.map((item) => ({
      description: item.name,
      value: item.value,
      quantity: item.quantity,
      image: item.image_url || '',
    }));

    // Prepare purchase params
    const purchaseParams: PurchaseGITParams = {
      first_name: body.customer.first_name,
      last_name: body.customer.last_name,
      email: body.customer.email,
      phone_number: body.customer.phone,
      address: body.shipping.delivery_address,
      pickup_location: body.shipping.pickup_address,
      drop_off_location: body.shipping.delivery_address,
      shipping_date: body.shipping.shipping_date,
      vehicle_type: body.shipping.vehicle_type || 'Car',
      item_value: body.total_value,
      item_details: itemDetails,
    };

    // Purchase insurance from MyCover
    const policy = await myCover.purchaseShippingInsurance(purchaseParams);

    // Create admin Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store policy in our database
    const { data: insuranceRecord, error: dbError } = await supabase
      .from('order_insurance_policies')
      .insert({
        order_id: body.order_id,
        merchant_id: body.merchant_id,
        mycover_policy_id: policy.id,
        mycover_policy_number: policy.policy_number,
        mycover_purchase_id: policy.purchase_id,
        coverage_amount: body.total_value,
        premium_amount: policy.genius_price,
        premium_currency: 'NGN',
        policy_start_date: policy.start_date,
        policy_expiry_date: policy.expiration_date,
        status: 'active',
        customer_name: `${body.customer.first_name} ${body.customer.last_name}`,
        customer_email: body.customer.email,
        customer_phone: body.customer.phone,
        shipping_address: body.shipping,
        items_insured: body.items,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Insurance Purchase] DB Error:', dbError);
      // Policy was purchased but DB save failed - log for manual reconciliation
      return NextResponse.json({
        success: true,
        warning: 'Policy purchased but local record failed to save',
        policy: {
          id: policy.id,
          policy_number: policy.policy_number,
          premium: policy.genius_price,
          coverage: body.total_value,
        },
      });
    }

    return NextResponse.json({
      success: true,
      policy: {
        id: insuranceRecord.id,
        mycover_policy_id: policy.id,
        policy_number: policy.policy_number,
        premium: policy.genius_price,
        coverage: body.total_value,
        start_date: policy.start_date,
        expiry_date: policy.expiration_date,
      },
    });
  } catch (error) {
    console.error('[Insurance Purchase] Error:', error);

    if (error instanceof MyCoverError) {
      return NextResponse.json(
        {
          error: 'Insurance purchase failed',
          details: error.message,
        },
        { status: error.status >= 400 && error.status < 500 ? 400 : 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to purchase insurance' },
      { status: 500 }
    );
  }
}
