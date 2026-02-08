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

import { customAlphabet } from 'nanoid';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  capturePaymentWithCrypto,
  formatPhoneToE164,
  generatePaymentReference as generateJuicywayReference,
  getChainConfirmationTime,
  getPaymentSession,
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

const PAYMENT_GATEWAYS = [
  'paystack',
  'korapay',
  'juicyway',
  'credit_direct',
  'credpal',
] as const;
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
  order_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('NGN'),
  customer_email: z.string().email(),
  customer_name: z.string().min(1),
  customer_phone: z.string().min(1, 'Phone number is required'),
  gateway: z.enum(PAYMENT_GATEWAYS).optional(),
  billing_address: BillingAddressSchema,
  items: z.array(OrderItemSchema).optional(),
  channels: z.array(z.string()).optional(),
  // Payment type: 'dva' for Dedicated Virtual Account (bank transfer)
  payment_type: z.enum(['dva']).optional(),
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
    !ip.startsWith('::') &&
    !ip.startsWith('172.16.') &&
    !ip.startsWith('172.17.') &&
    !ip.startsWith('172.18.') &&
    !ip.startsWith('172.19.') &&
    !ip.startsWith('172.2') &&
    !ip.startsWith('172.30.') &&
    !ip.startsWith('172.31.') &&
    !ip.startsWith('fe80:') &&
    !ip.startsWith('fc00:') &&
    !ip.startsWith('fd')
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
  dva?: {
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
  redirectUrl: string,
  reference: string,
  merchantId: string
): Promise<PaymentResult> {
  const fees = calculateKorapayFee(data.amount);
  const { firstName, lastName } = parseCustomerName(data.customer_name);
  const amountInMinor = Math.round(data.amount * 100);

  // Determine if this is a crypto payment
  // 2026 Resilience: Default to crypto (USDT/TRX) if gateway is juicyway but no details provided
  // to avoid "Card payment checkout not available" errors.
  const isCryptoPayment = (data.crypto_chain && data.crypto_currency) || true;
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
      identifier: data.order_id,
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
      merchant_id: merchantId,
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
  // Two-step process: 1) POST capture with crypto details, 2) Poll with GET if pending
  if (isCryptoPayment) {
    if (!juicywayData.id) {
      throw new Error(
        'Crypto payment session failed: no session ID returned by Juicyway. Please try again.'
      );
    }
    const MAX_POLL_ATTEMPTS = 10;
    const POLL_DELAY_MS = 2000;

    try {
      let paymentMethod:
        | {
            address: string;
            chain: JuicywayCryptoChain;
            currency: JuicywayStablecoin;
            qrcode?: string;
          }
        | undefined;
      let cryptoData:
        | {
            payment?: {
              id?: string;
              amount?: number;
              status?: string;
              payment_method?: typeof paymentMethod;
            };
          }
        | undefined;

      // Step 1: POST capture once to initiate address generation
      const captureResult = await capturePaymentWithCrypto(
        juicywayData.id,
        cryptoChain,
        cryptoCurrency
      );

      if (!captureResult.success) {
        throw new Error(
          captureResult.error || 'Failed to initiate crypto payment capture'
        );
      }

      cryptoData = captureResult.data;
      paymentMethod = cryptoData.payment?.payment_method;

      const juicywayMode =
        (process.env.JUICYWAY_BASE_URL || '').includes('sandbox') ||
        !process.env.JUICYWAY_BASE_URL
          ? 'sandbox'
          : 'live';

      console.log('Crypto capture response:', {
        status: cryptoData.payment?.status,
        hasAddress: !!paymentMethod?.address,
        paymentId: cryptoData.payment?.id,
        mode: juicywayMode,
        fullCaptureData: JSON.stringify(cryptoData).substring(0, 500),
      });

      // Step 2: If address not ready, poll with GET instead of re-POSTing
      if (!paymentMethod?.address) {
        let pollAttempt = 0;

        while (pollAttempt < MAX_POLL_ATTEMPTS) {
          pollAttempt++;
          await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));

          const pollResult = await getPaymentSession(juicywayData.id);

          if (!pollResult.success) {
            console.error(
              'Poll attempt %d failed:',
              pollAttempt,
              pollResult.error
            );
            continue;
          }

          const polledData = pollResult.data;
          cryptoData = polledData;
          paymentMethod = polledData.payment?.payment_method;

          console.log(
            'Poll attempt %d: Status=%s, Address=%s',
            pollAttempt,
            polledData.payment?.status,
            paymentMethod?.address ? 'ready' : 'pending'
          );

          if (paymentMethod?.address) {
            break;
          }

          if (pollAttempt === MAX_POLL_ATTEMPTS) {
            console.error(
              'No crypto address after all poll attempts. Full Data:',
              JSON.stringify(polledData, null, 2)
            );
            throw new Error(
              `Failed to generate crypto payment address: status ${polledData.payment?.status || 'unknown'} after ${MAX_POLL_ATTEMPTS} attempts (mode: ${juicywayMode})`
            );
          }
        }
      }

      // At this point, we should have paymentMethod with address
      if (!paymentMethod?.address) {
        throw new Error('Crypto address generation failed after polling');
      }

      // IMPORTANT: We need BOTH the session ID and the payment ID:
      // - session_id (juicywayData.id): Used for initial tracking
      // - payment_id (cryptoData.payment.id): Used for GET /payments/{id} verification
      const paymentId = cryptoData?.payment?.id;

      return {
        authorization_url: '', // No redirect needed for crypto payments
        crypto_payment: {
          address: paymentMethod.address,
          chain: paymentMethod.chain,
          currency: paymentMethod.currency,
          amount: cryptoData?.payment?.amount || amountInMinor,
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
  reference: string,
  merchantId: string
): Promise<PaymentResult> {
  const amountInKobo = Math.round(data.amount * 100);
  const fees = calculatePaystackFee(amountInKobo);

  // 2026 Resilience: Ensure phone number is formatted to E.164 for Paystack compatibility
  const customerPhone = data.customer_phone
    ? formatPhoneToE164(data.customer_phone)
    : undefined;

  // Debug log to confirm what we have after formatting
  console.log('[PaymentInit] Paystack Phone Debug:', {
    original: data.customer_phone,
    formatted: customerPhone,
    type: typeof customerPhone,
  });

  if (!customerPhone || customerPhone.length < 5) {
    throw new Error(
      'Invalid phone number provided. Please enter a valid mobile number.'
    );
  }

  const paystackData = await initializePaystackPayment({
    email: data.customer_email,
    amount: amountInKobo,
    phone: customerPhone,
    reference,
    callback_url: redirectUrl,
    subaccount: merchant.paystack_subaccount_code as string,
    transaction_charge: fees.platformFee,
    bearer: 'account',
    channels: (data.channels || ['card', 'bank', 'ussd', 'bank_transfer']) as (
      | 'card'
      | 'bank'
      | 'ussd'
      | 'bank_transfer'
    )[],
    metadata: {
      merchant_id: merchantId,
      order_id: data.order_id,
      customer_name: data.customer_name,
      customer_phone: customerPhone,
      gateway: data.gateway,
      // 2026 Fix: Redundant phone fields in metadata to satisfy different Paystack requirement settings
      phone: customerPhone,
      phone_number: customerPhone,
      platform_fee: fees.platformFee / 100,
      custom_fields: [
        {
          display_name: 'Phone Number',
          variable_name: 'phone_number',
          value: customerPhone?.replace(/^\+234/, '0') || 'N/A', // Convert E.164 to local format for specific merchant configs
        },
        {
          display_name: 'Mobile Number',
          variable_name: 'mobile_number',
          value: customerPhone?.replace(/^\+234/, '0') || 'N/A',
        },
        {
          display_name: 'Application ID',
          variable_name: 'application_id',
          value: 'baci_storefront',
        },
        {
          display_name: 'Platform',
          variable_name: 'platform',
          value: 'baci_web',
        },
      ],
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
  notificationUrl: string,
  merchantId: string
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
      merchant_id: merchantId,
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
    // CSRF exemption: This is a public storefront endpoint for checkout payment.
    // Guest users do not have CSRF tokens. The route validates order ownership
    // via get_order_payment_snapshot RPC (order_id + email match).

    // Parse and validate request body
    const body = await request.clone().json();
    console.log(
      '[PaymentInit] Raw Request Body:',
      JSON.stringify(body, null, 2)
    );

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

    // Initialize Supabase client
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Validate order context (order + email) before initiating payment
    const { data: snapshotRows, error: snapshotError } = await supabase.rpc(
      'get_order_payment_snapshot',
      {
        p_order_id: data.order_id,
        p_email: data.customer_email,
      }
    );

    const orderSnapshot = Array.isArray(snapshotRows) ? snapshotRows[0] : null;

    if (snapshotError || !orderSnapshot) {
      return createErrorResponse(
        'Order not found or email mismatch',
        'ORDER_NOT_FOUND',
        404
      );
    }

    if (orderSnapshot.merchant_id !== data.merchant_id) {
      return createErrorResponse(
        'Merchant mismatch for this order',
        'MERCHANT_MISMATCH',
        403
      );
    }

    // Validate order total: Number(null) => 0, Number(undefined) => NaN
    const snapshotTotal = Number(orderSnapshot.total);
    if (
      orderSnapshot.total == null ||
      Number.isNaN(snapshotTotal) ||
      snapshotTotal <= 0
    ) {
      return createErrorResponse(
        'Invalid order total',
        'INVALID_ORDER_TOTAL',
        400
      );
    }
    if (data.amount > snapshotTotal) {
      return createErrorResponse(
        'Amount exceeds order total',
        'AMOUNT_EXCEEDS_TOTAL',
        400
      );
    }

    const merchantId = orderSnapshot.merchant_id;

    // Use admin client for merchant config lookups.
    // The cookie-based client may be anonymous (e.g. mobile app requests)
    // and RLS on merchants table requires authenticated owner/staff access.
    // This is safe because the order→merchant relationship is already
    // validated above via the SECURITY DEFINER RPC.
    const adminClient = createAdminClient();

    // Fetch merchant
    const { data: merchant, error: merchantError } = await adminClient
      .from('merchants')
      .select('id, business_name, slug, paystack_subaccount_code')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return createErrorResponse(
        'Merchant not found',
        'MERCHANT_NOT_FOUND',
        404
      );
    }

    // Fetch gateway settings
    const { data: featureSettings } = await adminClient
      .from('merchant_feature_settings')
      .select(
        'paystack_enabled, korapay_enabled, preferred_local_gateway, preferred_international_gateway'
      )
      .eq('merchant_id', merchantId)
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

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const notificationUrl = `${protocol}://${rootDomain}/api/payments/webhook`;

    // Select gateway
    const hasPaystackSubaccount = !!merchant.paystack_subaccount_code;
    const gateway: PaymentGateway =
      data.gateway && PAYMENT_GATEWAYS.includes(data.gateway)
        ? data.gateway
        : selectGateway(validCurrency, gatewaySettings, hasPaystackSubaccount);

    // Generate reference and URLs
    // Use customAlphabet with uppercase-safe alphabet for consistent uppercase references
    const nanoidUppercase = customAlphabet(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      12
    );
    const reference =
      gateway === 'juicyway'
        ? generateJuicywayReference('baci')
        : `BAC-${nanoidUppercase()}`;
    const redirectUrl = `${protocol}://${merchant.slug}.${rootDomain}/checkout/success?reference=${reference}`;

    // Initialize payment based on gateway
    let paymentResult: PaymentResult;

    try {
      switch (gateway) {
        case 'juicyway':
          if (!process.env.JUICYWAY_SECRET_KEY) {
            return createErrorResponse(
              'Crypto payments (Juicyway) are not configured. Please contact support or use another payment method.',
              'GATEWAY_NOT_CONFIGURED',
              400
            );
          }
          paymentResult = await initializeJuicyway(
            request,
            data,
            merchant,
            redirectUrl,
            reference,
            merchantId
          );
          break;

        case 'paystack':
          if (!merchant.paystack_subaccount_code) {
            return createErrorResponse(
              'Paystack is not configured for this merchant',
              'GATEWAY_NOT_CONFIGURED',
              400
            );
          }

          // DVA (Dedicated Virtual Account) for bank transfer payments
          if (data.payment_type === 'dva') {
            const { createDedicatedVirtualAccount } = await import(
              '@/lib/agentic/paystack'
            );
            const { firstName, lastName } = parseCustomerName(
              data.customer_name
            );

            const dvaResult = await createDedicatedVirtualAccount({
              email: data.customer_email,
              first_name: firstName,
              last_name: lastName,
              phone: data.customer_phone || '',
            });

            const fees = calculatePaystackFee(Math.round(data.amount * 100));
            paymentResult = {
              authorization_url: '',
              dva: {
                bank_name: dvaResult.bank_name,
                account_number: dvaResult.account_number,
                account_name: dvaResult.account_name,
              },
              reference,
              platformFee: fees.platformFee / 100,
              merchantAmount: fees.merchantAmount / 100,
            };
          } else {
            paymentResult = await initializePaystack(
              data,
              merchant,
              redirectUrl,
              reference,
              merchantId
            );
          }
          break;
        case 'credit_direct':
        case 'credpal':
          // For client-side BNPL gateways, we redirect to the specialized launcher page
          // This page handles the client-side SDK loading and prevents checkout crashes
          paymentResult = {
            authorization_url: `${protocol}://${merchant.slug}.${rootDomain}/checkout/bnpl?orderId=${data.order_id}&gateway=${gateway}`,
            checkout_url: `${protocol}://${merchant.slug}.${rootDomain}/checkout/bnpl?orderId=${data.order_id}&gateway=${gateway}`,
            reference, // Use the generated reference
            platformFee: 0, // Fees calculated client-side or by gateway
            merchantAmount: data.amount, // Full amount (fees handled separately)
          };
          break;

        default:
          paymentResult = await initializeKorapay(
            data,
            merchant,
            redirectUrl,
            reference,
            notificationUrl,
            merchantId
          );
          break;
      }
    } catch (gatewayError) {
      const message =
        gatewayError instanceof Error ? gatewayError.message : 'Unknown error';
      console.error(
        'Gateway initialization failed [%s]:',
        gateway,
        gatewayError
      );
      return createErrorResponse(
        `Payment gateway (${gateway}) initialization failed: ${message}`,
        'GATEWAY_INIT_ERROR',
        502
      );
    }

    // Create transaction record (via RPC) and update order status
    const { error: transactionError } = await supabase.rpc(
      'create_payment_transaction',
      {
        p_merchant_id: merchantId,
        p_order_id: data.order_id,
        p_amount: data.amount,
        p_currency: validCurrency,
        p_gateway: gateway,
        p_reference: paymentResult.reference,
        p_platform_fee: paymentResult.platformFee,
        p_merchant_amount: paymentResult.merchantAmount,
        p_customer_email: data.customer_email,
        p_customer_name: data.customer_name,
        p_session_id: paymentResult.sessionId || null,
      }
    );

    if (transactionError) {
      console.error('Error creating transaction record:', transactionError);
      return createErrorResponse(
        'Failed to create transaction',
        'TRANSACTION_CREATE_FAILED',
        500
      );
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
      ...(paymentResult.dva && {
        dva: paymentResult.dva,
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
      },
      { status: 500 }
    );
  }
}
