import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  type Currency,
  calculatePlatformFee,
  initializePayment,
} from '@/lib/korapay';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      merchant_id,
      order_id,
      amount,
      currency = 'NGN',
      customer_email,
      customer_name,
    } = body;

    // Validate required fields
    if (!merchant_id || !amount || !customer_email || !customer_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, slug')
      .eq('id', merchant_id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Calculate platform fee and merchant amount
    const { platformFee, merchantAmount } = calculatePlatformFee(amount);

    // Generate unique reference
    const reference = `BAC-${nanoid(12).toUpperCase()}`;

    // Get root domain for redirect
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUrl = `${protocol}://${merchant.slug}.${rootDomain}/payment/success?reference=${reference}`;
    const notificationUrl = `${protocol}://${rootDomain}/api/payments/webhook`;

    // Initialize payment with Korapay
    const paymentData = await initializePayment({
      amount,
      currency: currency as Currency,
      customer: {
        name: customer_name,
        email: customer_email,
      },
      reference,
      narration: `Payment to ${merchant.business_name}`,
      redirect_url: redirectUrl,
      notification_url: notificationUrl,
      merchant_bears_cost: true,
      metadata: {
        merchant_id,
        order_id,
        platform_fee: platformFee,
        merchant_amount: merchantAmount,
      },
    });

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        merchant_id,
        order_id,
        transaction_type: 'payment',
        amount,
        currency,
        status: 'pending',
        gateway: 'korapay',
        gateway_reference: reference,
        platform_fee: platformFee,
        merchant_amount: merchantAmount,
        description: `Payment for order ${order_id || 'N/A'}`,
        metadata: {
          customer_email,
          customer_name,
        },
      });

    if (transactionError) {
      console.error('Error creating transaction record:', transactionError);
    }

    // Update order with payment reference if order_id provided
    if (order_id) {
      await supabase
        .from('orders')
        .update({
          payment_reference: reference,
          payment_status: 'pending',
          currency,
        })
        .eq('id', order_id);
    }

    return NextResponse.json({
      success: true,
      reference,
      checkout_url: paymentData.checkout_url,
      authorization_url: paymentData.authorization_url,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
