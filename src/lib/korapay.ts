/**
 * Korapay Payment Integration
 * Supports multi-currency payments, conversions, and payouts across Africa
 */

const KORAPAY_BASE_URL =
  process.env.KORAPAY_BASE_URL || 'https://api.korapay.com/merchant/api/v1';
const KORAPAY_SECRET_KEY = process.env.KORAPAY_SECRET_KEY || '';
const KORAPAY_PUBLIC_KEY = process.env.KORAPAY_PUBLIC_KEY || '';

// Platform fee percentage (5% default)
const PLATFORM_FEE_PERCENTAGE = Number.parseFloat(
  process.env.PLATFORM_FEE_PERCENTAGE || '5'
);

// Supported African currencies
export const SUPPORTED_CURRENCIES = [
  'NGN',
  'KES',
  'GHS',
  'ZAR',
  'XAF',
  'XOF',
] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

// Currency symbols
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  NGN: '₦',
  KES: 'KSh',
  GHS: 'GH₵',
  ZAR: 'R',
  XAF: 'FCFA',
  XOF: 'CFA',
};

// Currency names
export const CURRENCY_NAMES: Record<Currency, string> = {
  NGN: 'Nigerian Naira',
  KES: 'Kenyan Shilling',
  GHS: 'Ghanaian Cedi',
  ZAR: 'South African Rand',
  XAF: 'Central African CFA Franc',
  XOF: 'West African CFA Franc',
};

interface KorapayResponse<T = unknown> {
  status: boolean;
  message: string;
  data: T;
}

interface PaymentInitData {
  amount: number;
  currency: Currency;
  customer: {
    name: string;
    email: string;
  };
  merchant_bears_cost?: boolean;
  redirect_url?: string;
  reference?: string;
  narration?: string;
  notification_url?: string;
  metadata?: Record<string, unknown>;
}

interface PaymentInitResponse {
  reference: string;
  checkout_url: string;
  authorization_url: string;
}

interface PaymentVerificationResponse {
  reference: string;
  amount: number;
  currency: string;
  status: 'success' | 'pending' | 'failed';
  customer: {
    name: string;
    email: string;
  };
  paid_at: string;
  created_at: string;
}

interface ExchangeRateResponse {
  source_currency: string;
  destination_currency: string;
  rate: number;
}

interface ConversionRequest {
  source_currency: Currency;
  destination_currency: Currency;
  amount: number;
}

interface ConversionResponse {
  source_currency: string;
  destination_currency: string;
  source_amount: number;
  destination_amount: number;
  rate: number;
  reference: string;
}

interface PayoutRequest {
  reference: string;
  destination: {
    type: 'bank_account';
    amount: number;
    currency: Currency;
    narration: string;
    bank_account: {
      bank: string; // Bank code
      account: string; // Account number
      account_name?: string;
    };
    customer: {
      name: string;
      email?: string;
    };
  };
}

interface PayoutResponse {
  reference: string;
  status: 'processing' | 'success' | 'failed';
  amount: number;
  fee: number;
  currency: string;
}

/**
 * Make authenticated request to Korapay API
 */
async function korapayRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<KorapayResponse<T>> {
  const url = `${KORAPAY_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Korapay API Error:', data);
    throw new Error(data.message || 'Korapay API request failed');
  }

  return data;
}

/**
 * Initialize payment checkout
 */
export async function initializePayment(
  data: PaymentInitData
): Promise<PaymentInitResponse> {
  const response = await korapayRequest<PaymentInitResponse>(
    '/charges/initialize',
    {
      method: 'POST',
      body: JSON.stringify({
        amount: data.amount,
        currency: data.currency,
        customer: data.customer,
        merchant_bears_cost: data.merchant_bears_cost ?? true,
        redirect_url: data.redirect_url,
        reference: data.reference,
        narration: data.narration,
        notification_url: data.notification_url,
        metadata: data.metadata,
      }),
    }
  );

  return response.data;
}

/**
 * Verify payment status
 */
export async function verifyPayment(
  reference: string
): Promise<PaymentVerificationResponse> {
  const response = await korapayRequest<PaymentVerificationResponse>(
    `/charges/${reference}/verify`,
    { method: 'GET' }
  );

  return response.data;
}

/**
 * Get exchange rate between currencies
 */
export async function getExchangeRate(
  sourceCurrency: Currency,
  destinationCurrency: Currency
): Promise<ExchangeRateResponse> {
  const response = await korapayRequest<ExchangeRateResponse>(
    `/misc/exchange-rates?source_currency=${sourceCurrency}&destination_currency=${destinationCurrency}`,
    { method: 'GET' }
  );

  return response.data;
}

/**
 * Convert currency amount
 */
export async function convertCurrency(
  data: ConversionRequest
): Promise<ConversionResponse> {
  const response = await korapayRequest<ConversionResponse>(
    '/balances/convert',
    {
      method: 'POST',
      body: JSON.stringify({
        source_currency: data.source_currency,
        destination_currency: data.destination_currency,
        amount: data.amount,
      }),
    }
  );

  return response.data;
}

/**
 * Send payout to bank account
 */
export async function sendPayout(data: PayoutRequest): Promise<PayoutResponse> {
  const response = await korapayRequest<PayoutResponse>(
    '/transactions/disburse',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );

  return response.data;
}

/**
 * Send bulk payouts to multiple accounts
 */
export async function sendBulkPayouts(
  payouts: PayoutRequest[]
): Promise<PayoutResponse[]> {
  const response = await korapayRequest<PayoutResponse[]>(
    '/transactions/disburse/bulk',
    {
      method: 'POST',
      body: JSON.stringify({ payouts }),
    }
  );

  return response.data;
}

/**
 * Get available banks for a country
 */
export async function getBanks(
  country: 'NG' | 'KE' | 'GH' | 'ZA'
): Promise<Array<{ name: string; code: string }>> {
  const response = await korapayRequest<Array<{ name: string; code: string }>>(
    `/misc/banks?country=${country}`,
    { method: 'GET' }
  );

  return response.data;
}

/**
 * Resolve bank account details
 */
export async function resolveBankAccount(
  bankCode: string,
  accountNumber: string
): Promise<{ account_name: string; account_number: string }> {
  const response = await korapayRequest<{
    account_name: string;
    account_number: string;
  }>(`/misc/banks/resolve`, {
    method: 'POST',
    body: JSON.stringify({
      bank: bankCode,
      account: accountNumber,
    }),
  });

  return response.data;
}

/**
 * Calculate platform fee and merchant amount
 */
export function calculatePlatformFee(amount: number): {
  platformFee: number;
  merchantAmount: number;
  total: number;
} {
  const platformFee = (amount * PLATFORM_FEE_PERCENTAGE) / 100;
  const merchantAmount = amount - platformFee;

  return {
    platformFee: Math.round(platformFee * 100) / 100,
    merchantAmount: Math.round(merchantAmount * 100) / 100,
    total: amount,
  };
}

/**
 * Get Korapay public key for frontend
 */
export function getPublicKey(): string {
  return KORAPAY_PUBLIC_KEY;
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Detect currency from country code
 */
export function getCurrencyFromCountry(countryCode: string): Currency {
  const currencyMap: Record<string, Currency> = {
    NG: 'NGN',
    KE: 'KES',
    GH: 'GHS',
    ZA: 'ZAR',
    CM: 'XAF',
    CI: 'XOF',
    SN: 'XOF',
    BF: 'XOF',
  };

  return currencyMap[countryCode.toUpperCase()] || 'NGN';
}

export { PLATFORM_FEE_PERCENTAGE };
