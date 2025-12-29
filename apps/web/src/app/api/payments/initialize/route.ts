/**
 * Payment Initialization API Route
 *
 * 2025 Best Practices:
 * - Zod schema validation for request body
 * - Structured error responses with error codes
 * - Early returns for cleaner flow
 * - Type-safe gateway selection
 * - Proper separation of concerns
 */

import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  capturePaymentWithCrypto,
  formatPhoneToE164,
  generatePaymentReference as generateJuicywayReference,
  getChainConfirmationTime,
  initializePayment as initializeJuicywayPayment,
  isSupportedCurrency as isJuicywayCurrency,
  JUICYWAY_CHAIN_SUPPORT,
  type JuicywayCryptoChain,
  type JuicywayStablecoin,
} from '@/lib/juicyway';
import {
  type Currency,
  calculatePlatformFee as calculateKorapayFee,
  initializePayment as initializeKorapayPayment,
  SUPPORTED_CURRENCIES,
} from '@/lib/korapay';
import {
  calculatePlatformFee as calculatePaystackFee,
  initializeTransaction as initializePaystackPayment,
} from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// Types & Constants
// =============================================================================

const PAYMENT_GATEWAYS = ['paystack', 'korapay', 'juicyway'] as const;
type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

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

// =============================================================================
// Zod Validation Schema
// =============================================================================

const BillingAddressSchema = z
  .object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().optional(),
    country: z.string().length(2),
    zip_code: z.string().min(1),
  })
  .optional();

const OrderItemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['digital', 'physical']),
});

const PaymentInitRequestSchema = z.object({
  merchant_id: z.string().uuid(),
  order_id: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().default('NGN'),
  customer_email: z.string().email(),
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  gateway: z.enum(PAYMENT_GATEWAYS).optional(),
  billing_address: BillingAddressSchema,
  items: z.array(OrderItemSchema).optional(),
  channels: z.array(z.string()).optional(),
  // Crypto payment options (only for juicyway gateway)
  crypto_chain: z.enum(['TRX', 'ETH', 'MATIC', 'AVAXC']).optional(),
  crypto_currency: z.enum(['USDT', 'USDC']).optional(),
});

type PaymentInitRequest = z.infer<typeof PaymentInitRequestSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

function createErrorResponse(
  error: string,
  code: string,
  status: number = 400
) {
  return NextResponse.json({ error, code }, { status });
}

function selectGateway(
  currency: string,
  settings: GatewaySettings,
  hasPaystackSubaccount: boolean
): PaymentGateway {
  const isLocalPayment = currency === 'NGN';

  if (isLocalPayment) {
    const preferred = settings.preferred_local_gateway;

    if (
      preferred === 'paystack' &&
      settings.paystack_enabled &&
      hasPaystackSubaccount
    ) {
      return 'paystack';
    }
    if (preferred === 'korapay' && settings.korapay_enabled) {
      return 'korapay';
    }
    if (settings.paystack_enabled && hasPaystackSubaccount) {
      return 'paystack';
    }
    if (settings.korapay_enabled) {
      return 'korapay';
    }
    return 'paystack';
  }

  // International payments
  const preferred = settings.preferred_international_gateway;

  if (preferred === 'korapay' && settings.korapay_enabled) {
    return 'korapay';
  }
  if (
    preferred === 'paystack' &&
    settings.paystack_enabled &&
    hasPaystackSubaccount
  ) {
    return 'paystack';
  }
  if (settings.korapay_enabled) {
    return 'korapay';
  }
  return 'korapay';
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor || realIp;

  // Check if it's a valid public IPv4 (not localhost/private)
  if (
    ip &&
    !ip.startsWith('127.') &&
    !ip.startsWith('192.168.') &&
    !ip.startsWith('10.') &&
    !ip.startsWith('::')
  ) {
    return ip;
  }
  // Use a placeholder public IP for development/testing
  return '41.217.100.1';
}

function parseCustomerName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(' ');
  return {
    firstName: parts[0] || 'Customer',
    lastName: parts.slice(1).join(' ') || 'User',
  };
}

// =============================================================================
// Gateway-Specific Payment Handlers
// =============================================================================

interface PaymentResult {
  authorization_url: string;
  checkout_url?: string;
  virtual_account?: {
    bank_name: string;
    account_number: string;
    account_name: string;
  };
  crypto_payment?: {
    address: string;
    chain: JuicywayCryptoChain;
    currency: JuicywayStablecoin;
    amount: number;
    confirmation_time: string;
    qrcode?: string;
    payment_id?: string; // Payment ID for verification (different from session ID)
  };
  reference: string;
  platformFee: number;
  merchantAmount: number;
  sessionId?: string;
}

async function initializeJuicyway(
  request: NextRequest,
  data: PaymentInitRequest,
  merchant: { business_name: string },
  redirectUrl: string
): Promise<PaymentResult> {
  const fees = calculateKorapayFee(data.amount);
  const reference = generateJuicywayReference('baci');
  const { firstName, lastName } = parseCustomerName(data.customer_name);
  const amountInMinor = Math.round(data.amount * 100);

  // Determine if this is a crypto payment
  const isCryptoPayment = data.crypto_chain && data.crypto_currency;
  const cryptoChain = (data.crypto_chain || 'TRX') as JuicywayCryptoChain;
  const cryptoCurrency = (data.crypto_currency || 'USDT') as JuicywayStablecoin;

  // For crypto payments:
  // - Send amount in NGN and let Juicyway handle real-time conversion
  // - Juicyway locks the rate for 15 minutes and uses aggregated exchange rates
  // For other payments, use NGN or the provided currency
  const paymentCurrency = isJuicywayCurrency(data.currency)
    ? data.currency
    : 'NGN';

  // Validate chain/currency compatibility for crypto payments
  if (isCryptoPayment) {
    const supportedChains = JUICYWAY_CHAIN_SUPPORT[cryptoCurrency];
    if (!supportedChains.includes(cryptoChain)) {
      throw new Error(
        `${cryptoCurrency} is not supported on ${cryptoChain}. Supported chains: ${supportedChains.join(', ')}`
      );
    }
  }

  // Log the payment request for debugging
  console.log('Juicyway payment request:', {
    amount: amountInMinor,
    currency: paymentCurrency,
    isCryptoPayment,
    cryptoChain: isCryptoPayment ? cryptoChain : undefined,
    cryptoCurrency: isCryptoPayment ? cryptoCurrency : undefined,
  });

  const juicywayData = await initializeJuicywayPayment({
    amount: amountInMinor, // Always send in NGN minor units (kobo), Juicyway handles conversion
    currency: paymentCurrency,
    customer: {
      first_name: firstName,
      last_name: lastName,
      email: data.customer_email,
      phone_number: data.customer_phone
        ? formatPhoneToE164(data.customer_phone)
        : '+2340000000000',
      billing_address: data.billing_address || {
        line1: 'Lagos, Nigeria',
        city: 'Lagos',
        country: 'NG',
        zip_code: '100001',
      },
      ip_address: getClientIp(request),
    },
    description:
      `${isCryptoPayment ? 'Crypto' : 'Card'} payment to ${merchant.business_name}`.substring(
        0,
        200
      ),
    reference,
    payment_method: { type: isCryptoPayment ? 'crypto_address' : 'card' },
    order: {
      identifier: data.order_id || reference,
      items: data.items || [
        {
          name: 'Order Payment',
          type: isCryptoPayment ? 'digital' : 'physical',
        },
      ],
    },
    redirect_url: redirectUrl,
    // direction is required for crypto payments
    ...(isCryptoPayment && { direction: 'incoming' as const }),
    metadata: {
      merchant_id: data.merchant_id,
      order_id: data.order_id,
      platform_fee: fees.platformFee,
      merchant_amount: fees.merchantAmount,
      payment_type: isCryptoPayment ? 'crypto' : 'card',
      original_ngn_amount: amountInMinor, // Store original amount for reference
    },
  });

  // Handle bank transfer response (returns virtual account)
  if (
    juicywayData.payment_method?.type === 'bank_account' &&
    juicywayData.payment_method.account_number
  ) {
    return {
      authorization_url: '',
      virtual_account: {
        bank_name: juicywayData.payment_method.bank_name || 'Bank',
        account_number: juicywayData.payment_method.account_number,
        account_name:
          juicywayData.payment_method.account_name || 'JUICE PAYMENTS',
      },
      reference,
      platformFee: fees.platformFee,
      merchantAmount: fees.merchantAmount,
      sessionId: juicywayData.id,
    };
  }

  // For crypto payments, we need to capture the payment to get the wallet address
  // This is a two-step process: 1) Initialize session, 2) Capture with crypto details
  if (isCryptoPayment && juicywayData.id) {
    console.log('Capturing crypto payment session:', {
      sessionId: juicywayData.id,
      chain: cryptoChain,
      currency: cryptoCurrency,
    });

    try {
      const captureResult = await capturePaymentWithCrypto(
        juicywayData.id,
        cryptoChain,
        cryptoCurrency
      );

      if (!captureResult.success) {
        console.error('Failed to capture crypto payment:', captureResult.error);
        throw new Error(
          captureResult.error || 'Failed to generate crypto payment address'
        );
      }

      const cryptoData = captureResult.data;
      const paymentMethod = cryptoData.payment?.payment_method;

      if (!paymentMethod?.address) {
        console.error('No crypto address in capture response. Full Data:', JSON.stringify(cryptoData, null, 2));
        throw new Error(
          `Failed to generate crypto payment address: partial response. Status: ${cryptoData.payment?.status}`
        );
      }

      // IMPORTANT: We need BOTH the session ID and the payment ID:
      // - session_id (juicywayData.id): Used for initial tracking
      // - payment_id (cryptoData.payment.id): Used for GET /payments/{id} verification
      const paymentId = cryptoData.payment?.id;

      console.log('Crypto payment captured successfully:', {
        sessionId: juicywayData.id,
        paymentId,
        address: paymentMethod.address,
        chain: paymentMethod.chain,
        currency: paymentMethod.currency,
        amount: cryptoData.payment?.amount,
      });

      return {
        authorization_url: '', // No redirect needed for crypto payments
        crypto_payment: {
          address: paymentMethod.address,
          chain: paymentMethod.chain,
          currency: paymentMethod.currency,
          amount: cryptoData.payment?.amount || amountInMinor,
          confirmation_time: getChainConfirmationTime(paymentMethod.chain),
          qrcode: paymentMethod.qrcode, // Pass through QR code from API
          payment_id: paymentId, // Include payment ID for verification
        },
        reference,
        platformFee: fees.platformFee,
        merchantAmount: fees.merchantAmount,
        sessionId: juicywayData.id,
      };
    } catch (captureError) {
      console.error('Crypto capture exception:', captureError);
      throw new Error(
        captureError instanceof Error
          ? captureError.message
          : 'Crypto payment address generation failed. Please try again.'
      );
    }
  }

  // For card payments, check if we have a checkout URL
  console.log('Juicyway card payment response:', {
    sessionId: juicywayData.id,
    paymentMethod: juicywayData.payment_method?.type,
    hasCheckoutUrl: !!juicywayData.checkout_url,
    checkoutUrl: juicywayData.checkout_url,
    links: juicywayData.links,
    status: juicywayData.status,
  });

  // If no checkout URL is returned for card payment, throw an error
  if (!juicywayData.checkout_url) {
    console.error('Juicyway did not return a checkout URL for card payment', {
      sessionId: juicywayData.id,
      paymentMethod: juicywayData.payment_method?.type,
      fullResponse: juicywayData,
    });
    throw new Error(
      'Card payment checkout not available. Please try again or use an alternative payment method.'
    );
  }

  return {
    authorization_url: juicywayData.checkout_url,
    checkout_url: juicywayData.checkout_url,
    reference,
    platformFee: fees.platformFee,
    merchantAmount: fees.merchantAmount,
    sessionId: juicywayData.id,
  };
}

async function initializePaystack(
  data: PaymentInitRequest,
  merchant: { paystack_subaccount_code: string | null },
  redirectUrl: string,
  reference: string
): Promise<PaymentResult> {
  const amountInKobo = Math.round(data.amount * 100);
  const fees = calculatePaystackFee(amountInKobo);

  const paystackData = await initializePaystackPayment({
    email: data.customer_email,
    amount: amountInKobo,
    reference,
    callback_url: redirectUrl,
    subaccount: merchant.paystack_subaccount_code as string,
    transaction_charge: fees.platformFee,
    bearer: 'account',
    channels: (data.channels || [
      'card',
      'bank',
      'ussd',
      'bank_transfer',
      'mobile_money',
      'qr',
    ]) as (
      | 'card'
      | 'bank'
      | 'ussd'
      | 'qr'
      | 'mobile_money'
      | 'bank_transfer'
    )[],
    metadata: {
      merchant_id: data.merchant_id,
      order_id: data.order_id,
      customer_name: data.customer_name,
      platform_fee: fees.platformFee / 100,
      merchant_amount: fees.merchantAmount / 100,
    },
  });

  return {
    authorization_url: paystackData.authorization_url,
    checkout_url: paystackData.authorization_url,
    reference,
    platformFee: fees.platformFee / 100,
    merchantAmount: fees.merchantAmount / 100,
  };
}

async function initializeKorapay(
  data: PaymentInitRequest,
  merchant: { business_name: string },
  redirectUrl: string,
  reference: string,
  notificationUrl: string
): Promise<PaymentResult> {
  const fees = calculateKorapayFee(data.amount);

  const korapayData = await initializeKorapayPayment({
    amount: data.amount,
    currency: data.currency as Currency,
    customer: {
      name: data.customer_name,
      email: data.customer_email,
    },
    reference,
    narration: `Payment to ${merchant.business_name}`,
    redirect_url: redirectUrl,
    notification_url: notificationUrl,
    merchant_bears_cost: true,
    metadata: {
      merchant_id: data.merchant_id,
      order_id: data.order_id,
      platform_fee: fees.platformFee,
      merchant_amount: fees.merchantAmount,
    },
  });

  return {
    authorization_url: korapayData.authorization_url,
    checkout_url: korapayData.checkout_url,
    reference,
    platformFee: fees.platformFee,
    merchantAmount: fees.merchantAmount,
  };
}

// =============================================================================
// Main Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parseResult = PaymentInitRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return createErrorResponse(
        `Validation error: ${firstError.path.join('.')} - ${firstError.message}`,
        'VALIDATION_ERROR'
      );
    }

    const data = parseResult.data;

    // Validate currency
    const validCurrency = SUPPORTED_CURRENCIES.includes(
      data.currency as Currency
    )
      ? data.currency
      : 'NGN';

    // Initialize Supabase clients
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const adminSupabase = createAdminClient();

    // Fetch merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, slug, paystack_subaccount_code')
      .eq('id', data.merchant_id)
      .single();

    if (merchantError || !merchant) {
      return createErrorResponse(
        'Merchant not found',
        'MERCHANT_NOT_FOUND',
        404
      );
    }

    // Fetch gateway settings
    const { data: featureSettings } = await supabase
      .from('merchant_feature_settings')
      .select(
        'paystack_enabled, korapay_enabled, preferred_local_gateway, preferred_international_gateway'
      )
      .eq('merchant_id', data.merchant_id)
      .single();

    const gatewaySettings: GatewaySettings = featureSettings
      ? {
        paystack_enabled: featureSettings.paystack_enabled ?? true,
        korapay_enabled: featureSettings.korapay_enabled ?? true,
        preferred_local_gateway:
          (featureSettings.preferred_local_gateway as PaymentGateway) ||
          'paystack',
        preferred_international_gateway:
          (featureSettings.preferred_international_gateway as PaymentGateway) ||
          'korapay',
      }
      : DEFAULT_GATEWAY_SETTINGS;

    // Generate reference and URLs
    const reference = `BAC-${nanoid(12).toUpperCase()}`;
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUrl = `${protocol}://${merchant.slug}.${rootDomain}/checkout/success?reference=${reference}`;
    const notificationUrl = `${protocol}://${rootDomain}/api/payments/webhook`;

    // Select gateway
    const hasPaystackSubaccount = !!merchant.paystack_subaccount_code;
    const gateway: PaymentGateway =
      data.gateway && PAYMENT_GATEWAYS.includes(data.gateway)
        ? data.gateway
        : selectGateway(validCurrency, gatewaySettings, hasPaystackSubaccount);

    // Initialize payment based on gateway
    let paymentResult: PaymentResult;

    switch (gateway) {
      case 'juicyway':
        paymentResult = await initializeJuicyway(
          request,
          data,
          merchant,
          redirectUrl
        );
        break;

      case 'paystack':
        paymentResult = await initializePaystack(
          data,
          merchant,
          redirectUrl,
          reference
        );
        break;
      default:
        paymentResult = await initializeKorapay(
          data,
          merchant,
          redirectUrl,
          reference,
          notificationUrl
        );
        break;
    }

    // Create transaction record (use admin client to bypass RLS)
    const { error: transactionError } = await adminSupabase
      .from('transactions')
      .insert({
        merchant_id: data.merchant_id,
        order_id: data.order_id,
        transaction_type: 'payment',
        amount: data.amount,
        currency: validCurrency,
        status: 'pending',
        gateway,
        gateway_reference: paymentResult.reference,
        platform_fee: paymentResult.platformFee,
        merchant_amount: paymentResult.merchantAmount,
        description: `Payment for order ${data.order_id || 'N/A'}`,
        metadata: {
          customer_email: data.customer_email,
          customer_name: data.customer_name,
          ...(paymentResult.sessionId && {
            session_id: paymentResult.sessionId,
          }),
        },
      });

    if (transactionError) {
      console.error('Error creating transaction record:', transactionError);
    }

    // Update order with payment reference (use admin client to bypass RLS)
    if (data.order_id) {
      await adminSupabase
        .from('orders')
        .update({
          payment_reference: paymentResult.reference,
          payment_status: 'pending',
          currency: validCurrency,
        })
        .eq('id', data.order_id);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      reference: paymentResult.reference,
      gateway,
      checkout_url: paymentResult.checkout_url,
      authorization_url: paymentResult.authorization_url,
      ...(paymentResult.virtual_account && {
        virtual_account: paymentResult.virtual_account,
      }),
      ...(paymentResult.crypto_payment && {
        crypto_payment: paymentResult.crypto_payment,
      }),
      ...(paymentResult.sessionId && {
        session_id: paymentResult.sessionId,
      }),
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize payment',
        code: 'PAYMENT_INIT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
