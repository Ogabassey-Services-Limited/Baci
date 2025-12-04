import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  type Currency,
  SUPPORTED_CURRENCIES,
  calculatePlatformFee as calculateKorapayFee,
  initializePayment as initializeKorapayPayment,
} from '@/lib/korapay';
import {
  initializeTransaction as initializePaystackPayment,
  calculatePlatformFee as calculatePaystackFee,
} from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';

type PaymentGateway = 'paystack' | 'korapay';

interface GatewaySettings {
  paystack_enabled: boolean;
  korapay_enabled: boolean;
  preferred_local_gateway: PaymentGateway;
  preferred_international_gateway: PaymentGateway;
}

const DEFAULT_GATEWAY_SETTINGS: GatewaySettings = {
  paystack_enabled: true,
  korapay_enabled: true,
  preferred_local_gateway: 'paystack',
  preferred_international_gateway: 'korapay',
};

/**
 * Determine which gateway to use based on currency and merchant settings
 */
function selectGateway(
  currency: string,
  settings: GatewaySettings,
  hasPaystackSubaccount: boolean
): PaymentGateway {
  const isLocalPayment = currency === 'NGN';

  if (isLocalPayment) {
    // For local NGN payments
    const preferred = settings.preferred_local_gateway;

    // If preferred is Paystack and it's enabled with subaccount
    if (preferred === 'paystack' && settings.paystack_enabled && hasPaystackSubaccount) {
      return 'paystack';
    }

    // If preferred is Korapay and it's enabled
    if (preferred === 'korapay' && settings.korapay_enabled) {
      return 'korapay';
    }

    // Fallback: try the other gateway
    if (settings.paystack_enabled && hasPaystackSubaccount) {
      return 'paystack';
    }
    if (settings.korapay_enabled) {
      return 'korapay';
    }

    // Default to paystack if nothing else works (will error if not configured)
    return 'paystack';
  } else {
    // For international payments (non-NGN)
    const preferred = settings.preferred_international_gateway;

    // Korapay supports multi-currency
    if (preferred === 'korapay' && settings.korapay_enabled) {
      return 'korapay';
    }

    // Paystack also supports some international payments
    if (preferred === 'paystack' && settings.paystack_enabled && hasPaystackSubaccount) {
      return 'paystack';
    }

    // Fallback: Korapay is better for international
    if (settings.korapay_enabled) {
      return 'korapay';
    }

    // Last resort
    return 'korapay';
  }
}

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

    // Validate currency for Korapay
    const validCurrency = SUPPORTED_CURRENCIES.includes(currency as Currency)
      ? currency
      : 'NGN';

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get merchant details including subaccount code
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, slug, paystack_subaccount_code')
      .eq('id', merchant_id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get merchant's payment gateway settings
    const { data: featureSettings } = await supabase
      .from('merchant_feature_settings')
      .select('paystack_enabled, korapay_enabled, preferred_local_gateway, preferred_international_gateway')
      .eq('merchant_id', merchant_id)
      .single();

    const gatewaySettings: GatewaySettings = featureSettings
      ? {
          paystack_enabled: featureSettings.paystack_enabled ?? true,
          korapay_enabled: featureSettings.korapay_enabled ?? true,
          preferred_local_gateway: (featureSettings.preferred_local_gateway as PaymentGateway) || 'paystack',
          preferred_international_gateway: (featureSettings.preferred_international_gateway as PaymentGateway) || 'korapay',
        }
      : DEFAULT_GATEWAY_SETTINGS;

    // Generate unique reference
    const reference = `BAC-${nanoid(12).toUpperCase()}`;

    // Get root domain for redirect
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUrl = `${protocol}://${merchant.slug}.${rootDomain}/payment/success?reference=${reference}`;

    // Select gateway based on currency and merchant settings
    const hasPaystackSubaccount = !!merchant.paystack_subaccount_code;
    const gateway = selectGateway(validCurrency, gatewaySettings, hasPaystackSubaccount);

    let paymentData: { authorization_url: string; checkout_url?: string };
    let platformFee: number;
    let merchantAmount: number;

    if (gateway === 'paystack') {
      // Use Paystack with subaccount split
      // Amount in kobo (smallest unit)
      const amountInKobo = Math.round(amount * 100);
      const fees = calculatePaystackFee(amountInKobo);
      platformFee = fees.platformFee / 100; // Convert back to Naira for storage
      merchantAmount = fees.merchantAmount / 100;

      const paystackData = await initializePaystackPayment({
        email: customer_email,
        amount: amountInKobo,
        reference,
        callback_url: redirectUrl,
        subaccount: merchant.paystack_subaccount_code!,
        transaction_charge: fees.platformFee, // Platform fee in kobo
        bearer: 'account', // Main account (platform) bears Paystack fees
        channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        metadata: {
          merchant_id,
          order_id,
          customer_name,
          platform_fee: platformFee,
          merchant_amount: merchantAmount,
        },
      });

      paymentData = {
        authorization_url: paystackData.authorization_url,
        checkout_url: paystackData.authorization_url,
      };
    } else {
      // Use Korapay for payments
      const fees = calculateKorapayFee(amount);
      platformFee = fees.platformFee;
      merchantAmount = fees.merchantAmount;

      const notificationUrl = `${protocol}://${rootDomain}/api/payments/webhook`;

      const korapayData = await initializeKorapayPayment({
        amount,
        currency: validCurrency as Currency,
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

      paymentData = {
        authorization_url: korapayData.authorization_url,
        checkout_url: korapayData.checkout_url,
      };
    }

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
        gateway,
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
      gateway,
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
