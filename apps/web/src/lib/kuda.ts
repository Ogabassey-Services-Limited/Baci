/**
 * Kuda Open API Client Library
 * Provides VTU (Value Top-Up) services: Airtime, Data, Bills
 *
 * API Documentation: https://docs.kuda.com/
 */

import crypto from 'node:crypto';

// Environment configuration
const KUDA_API_BASE_URL =
  process.env.KUDA_API_BASE_URL || 'https://kuda-openapi.kuda.com/v2.1';
const KUDA_EMAIL = process.env.KUDA_EMAIL || '';
const KUDA_API_KEY = process.env.KUDA_API_KEY || '';

// Service Types for Kuda API
export enum KudaServiceType {
  // Authentication
  GET_TOKEN = 'GET_TOKEN',

  // Bill Services
  GET_BILL_TYPES = 'GET_BILL_TYPES',
  GET_BILLERS_BY_TYPE = 'GET_BILLERS_BY_TYPE',
  VERIFY_BILL_CUSTOMER = 'VERIFY_BILL_CUSTOMER',
  ADMIN_PURCHASE_BILL = 'ADMIN_PURCHASE_BILL',
  PURCHASE_BILL = 'PURCHASE_BILL',
  BILL_TSQ = 'BILL_TSQ', // Transaction status query
  ADMIN_GET_PURCHASED_BILLS = 'ADMIN_GET_PURCHASED_BILLS',

  // Virtual Account Services
  ADMIN_CREATE_VIRTUAL_ACCOUNT = 'ADMIN_CREATE_VIRTUAL_ACCOUNT',
  RETRIEVE_VIRTUAL_ACCOUNT = 'RETRIEVE_VIRTUAL_ACCOUNT',

  // Transfer Services
  BANK_LIST = 'BANK_LIST',
  NAME_ENQUIRY = 'NAME_ENQUIRY',
  SINGLE_FUND_TRANSFER = 'SINGLE_FUND_TRANSFER',

  // Account Services
  ADMIN_MAIN_ACCOUNT_BALANCE = 'ADMIN_MAIN_ACCOUNT_BALANCE',
}

// Bill Types
export enum BillType {
  AIRTIME = 'airtime',
  DATA = 'internet_data',
  ELECTRICITY = 'electricity',
  CABLE_TV = 'cable_tv',
  BETTING = 'betting',
}

// Network Providers
export enum NetworkProvider {
  MTN = 'MTN',
  AIRTEL = 'AIRTEL',
  GLO = 'GLO',
  MOBILE_9 = '9MOBILE',
}

// Data Plan Types
export interface DataPlan {
  id: string;
  name: string;
  amount: number;
  validity: string;
  provider: NetworkProvider;
}

// Biller Information
export interface Biller {
  billerId: string;
  billerName: string;
  billerType: string;
  categoryId: string;
  categoryName: string;
}

// Bill Item (specific product from a biller)
export interface BillItem {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
}

// Purchase Result
export interface PurchaseResult {
  success: boolean;
  reference: string;
  transactionId?: string;
  message: string;
  status: 'pending' | 'successful' | 'failed';
  amount: number;
  phoneNumber?: string;
  provider?: string;
}

// Kuda API Response
interface KudaApiResponse<T = unknown> {
  status: boolean;
  message: string;
  data?: T;
}

// Token storage (in production, use Redis or database)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Generate a unique request reference
 */
export function generateRequestRef(): string {
  return `BACI-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Get authentication token from Kuda
 */
async function getToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const response = await fetch(`${KUDA_API_BASE_URL}/Account/GetToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: KUDA_EMAIL,
      apiKey: KUDA_API_KEY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Kuda token: ${response.statusText}`);
  }

  const token = await response.text();

  // Cache token for 55 minutes (tokens expire in 1 hour)
  cachedToken = {
    token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  return token;
}

/**
 * Make authenticated request to Kuda API
 */
export async function kudaRequest<T = unknown>(
  serviceType: KudaServiceType,
  data: Record<string, unknown> = {},
  requestRef?: string
): Promise<KudaApiResponse<T>> {
  const token = await getToken();
  const ref = requestRef || generateRequestRef();

  const payload = {
    serviceType,
    requestRef: ref,
    data,
  };

  const response = await fetch(KUDA_API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Kuda API request failed: ${response.statusText}`);
  }

  return response.json();
}

// ============================================
// AIRTIME & DATA SERVICES
// ============================================

/**
 * Get list of bill types (Airtime, Data, Electricity, etc.)
 */
export async function getBillTypes(): Promise<Biller[]> {
  const response = await kudaRequest<{ billers: Biller[] }>(
    KudaServiceType.GET_BILL_TYPES
  );
  return response.data?.billers || [];
}

/**
 * Get billers by type (e.g., all airtime providers)
 */
export async function getBillersByType(
  billTypeName: string
): Promise<Biller[]> {
  const response = await kudaRequest<{ billers: Biller[] }>(
    KudaServiceType.GET_BILLERS_BY_TYPE,
    { BillTypeName: billTypeName }
  );
  return response.data?.billers || [];
}

/**
 * Get airtime providers
 */
export function getAirtimeProviders(): Promise<Biller[]> {
  return getBillersByType('Airtime');
}

/**
 * Get data providers
 */
export function getDataProviders(): Promise<Biller[]> {
  return getBillersByType('Internet Data');
}

/**
 * Verify a customer before bill purchase
 */
export async function verifyBillCustomer(
  kudaBillItemIdentifier: string,
  customerIdentification: string
): Promise<{ verified: boolean; customerName?: string; message: string }> {
  try {
    const response = await kudaRequest<{
      customerName: string;
      canVend: boolean;
    }>(KudaServiceType.VERIFY_BILL_CUSTOMER, {
      KudaBillItemIdentifier: kudaBillItemIdentifier,
      CustomerIdentification: customerIdentification,
    });

    return {
      verified: response.data?.canVend || false,
      customerName: response.data?.customerName,
      message: response.message,
    };
  } catch (error) {
    return {
      verified: false,
      message: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Purchase airtime using the primary (admin) account
 */
export async function purchaseAirtime(
  phoneNumber: string,
  amount: number,
  networkProvider: NetworkProvider
): Promise<PurchaseResult> {
  const requestRef = generateRequestRef();

  // Map network provider to Kuda VTU identifier
  // These identifiers are from the Kuda API response
  const billItemIdentifiers: Record<NetworkProvider, string> = {
    [NetworkProvider.MTN]: 'KD-VTU-MTNNG',
    [NetworkProvider.AIRTEL]: 'KD-VTU-ATNG',
    [NetworkProvider.GLO]: 'KD-VTU-GLNG',
    [NetworkProvider.MOBILE_9]: 'KD-VTU-9NG',
  };

  const billItemIdentifier = billItemIdentifiers[networkProvider];

  if (!billItemIdentifier) {
    return {
      success: false,
      reference: requestRef,
      message: `Invalid network provider: ${networkProvider}`,
      status: 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  }

  try {
    const response = await kudaRequest<{
      transactionReference: string;
      status: string;
    }>(
      KudaServiceType.ADMIN_PURCHASE_BILL,
      {
        Amount: amount.toString(),
        BillItemIdentifier: billItemIdentifier,
        PhoneNumber: phoneNumber,
        CustomerIdentifier: phoneNumber,
      },
      requestRef
    );

    return {
      success: response.status,
      reference: requestRef,
      transactionId: response.data?.transactionReference,
      message: response.message,
      status: response.status ? 'successful' : 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  } catch (error) {
    return {
      success: false,
      reference: requestRef,
      message: error instanceof Error ? error.message : 'Purchase failed',
      status: 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  }
}

/**
 * Purchase data bundle
 */
export async function purchaseData(
  phoneNumber: string,
  dataPlanCode: string,
  amount: number,
  networkProvider: NetworkProvider
): Promise<PurchaseResult> {
  const requestRef = generateRequestRef();

  try {
    const response = await kudaRequest<{
      transactionReference: string;
      status: string;
    }>(
      KudaServiceType.ADMIN_PURCHASE_BILL,
      {
        Amount: amount.toString(),
        BillItemIdentifier: dataPlanCode,
        PhoneNumber: phoneNumber,
        CustomerIdentifier: phoneNumber,
      },
      requestRef
    );

    return {
      success: response.status,
      reference: requestRef,
      transactionId: response.data?.transactionReference,
      message: response.message,
      status: response.status ? 'successful' : 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  } catch (error) {
    return {
      success: false,
      reference: requestRef,
      message: error instanceof Error ? error.message : 'Purchase failed',
      status: 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  }
}

/**
 * Check transaction status
 */
export async function checkTransactionStatus(
  transactionReference: string
): Promise<{ status: string; message: string }> {
  const response = await kudaRequest<{ status: string }>(
    KudaServiceType.BILL_TSQ,
    { TransactionRequestReference: transactionReference }
  );

  return {
    status: response.data?.status || 'unknown',
    message: response.message,
  };
}

/**
 * Get purchased bills history
 */
export async function getPurchasedBills(
  pageSize: number = 20,
  pageNumber: number = 1
): Promise<{ bills: unknown[]; totalCount: number }> {
  const response = await kudaRequest<{
    bills: unknown[];
    totalCount: number;
  }>(KudaServiceType.ADMIN_GET_PURCHASED_BILLS, {
    PageSize: pageSize,
    PageNumber: pageNumber,
  });

  return {
    bills: response.data?.bills || [],
    totalCount: response.data?.totalCount || 0,
  };
}

// ============================================
// ACCOUNT SERVICES
// ============================================

/**
 * Get main account balance
 */
export async function getAccountBalance(): Promise<{
  availableBalance: number;
  ledgerBalance: number;
}> {
  const response = await kudaRequest<{
    availableBalance: number;
    ledgerBalance: number;
  }>(KudaServiceType.ADMIN_MAIN_ACCOUNT_BALANCE);

  return {
    availableBalance: response.data?.availableBalance || 0,
    ledgerBalance: response.data?.ledgerBalance || 0,
  };
}

// ============================================
// TRANSFER / PAYOUT SERVICES
// ============================================

export interface Bank {
  bankCode: string;
  bankName: string;
}

export interface NameEnquiryResult {
  beneficiaryAccountNumber: string;
  beneficiaryName: string;
  senderAccountNumber: string;
  senderName: string;
  beneficiaryCustomerID: number;
  beneficiaryBankCode: string;
  nameEnquiryID: number;
  responseCode: string;
  transferCharge: number;
  sessionID: string;
}

export interface TransferResult {
  success: boolean;
  reference: string;
  transactionId?: string;
  message: string;
  status: 'pending' | 'successful' | 'failed';
  amount: number;
}

/**
 * Get list of Nigerian banks
 */
export async function getBankList(): Promise<Bank[]> {
  const response = await kudaRequest<{ banks: Bank[] }>(
    KudaServiceType.BANK_LIST
  );
  return response.data?.banks || [];
}

/**
 * Verify bank account (Name Enquiry)
 * Required before making a transfer
 */
export async function verifyBankAccount(
  beneficiaryAccountNumber: string,
  beneficiaryBankCode: string
): Promise<{
  verified: boolean;
  accountName?: string;
  sessionId?: string;
  error?: string;
}> {
  try {
    const response = await kudaRequest<NameEnquiryResult>(
      KudaServiceType.NAME_ENQUIRY,
      {
        BeneficiaryAccountNumber: beneficiaryAccountNumber,
        BeneficiaryBankCode: beneficiaryBankCode,
      }
    );

    if (response.status && response.data?.beneficiaryName) {
      return {
        verified: true,
        accountName: response.data.beneficiaryName,
        sessionId: response.data.sessionID,
      };
    }

    return {
      verified: false,
      error: response.message || 'Account verification failed',
    };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Transfer funds to a bank account
 * Use this to pay out merchants their commission share
 */
export async function transferFunds(
  amount: number,
  beneficiaryAccountNumber: string,
  beneficiaryBankCode: string,
  beneficiaryName: string,
  narration: string,
  nameEnquirySessionId?: string
): Promise<TransferResult> {
  const requestRef = generateRequestRef();

  try {
    // If no session ID provided, do name enquiry first
    let sessionId = nameEnquirySessionId;
    if (!sessionId) {
      const verification = await verifyBankAccount(
        beneficiaryAccountNumber,
        beneficiaryBankCode
      );
      if (!verification.verified) {
        return {
          success: false,
          reference: requestRef,
          message: verification.error || 'Account verification failed',
          status: 'failed',
          amount,
        };
      }
      sessionId = verification.sessionId;
    }

    const response = await kudaRequest<{
      transactionReference: string;
      requestReference: string;
    }>(
      KudaServiceType.SINGLE_FUND_TRANSFER,
      {
        ClientAccountNumber: '', // Uses main account
        BeneficiaryAccount: beneficiaryAccountNumber,
        BeneficiaryBankCode: beneficiaryBankCode,
        BeneficiaryName: beneficiaryName,
        Amount: amount.toString(),
        Narration: narration,
        NameEnquirySessionID: sessionId,
        SenderName: 'Baci',
        ClientFeeCharge: 0,
      },
      requestRef
    );

    return {
      success: response.status,
      reference: requestRef,
      transactionId: response.data?.transactionReference,
      message: response.message,
      status: response.status ? 'successful' : 'failed',
      amount,
    };
  } catch (error) {
    return {
      success: false,
      reference: requestRef,
      message: error instanceof Error ? error.message : 'Transfer failed',
      status: 'failed',
      amount,
    };
  }
}

/**
 * Pay out merchant commission
 * Transfers accumulated VTU commission to merchant's bank account
 */
export function payoutMerchantCommission(
  merchantBankDetails: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  },
  amount: number,
  merchantId: string
): Promise<TransferResult> {
  const narration = `Baci VTU Commission Payout - ${merchantId.slice(0, 8)}`;

  return transferFunds(
    amount,
    merchantBankDetails.accountNumber,
    merchantBankDetails.bankCode,
    merchantBankDetails.accountName,
    narration
  );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Detect network provider from phone number
 */
export function detectNetworkProvider(
  phoneNumber: string
): NetworkProvider | null {
  // Remove country code and normalize
  const number = phoneNumber.replace(/^\+?234/, '0').replace(/\s/g, '');

  // MTN prefixes
  const mtnPrefixes = [
    '0703',
    '0706',
    '0803',
    '0806',
    '0810',
    '0813',
    '0814',
    '0816',
    '0903',
    '0906',
    '0913',
    '0916',
  ];

  // Airtel prefixes
  const airtelPrefixes = [
    '0701',
    '0708',
    '0802',
    '0808',
    '0812',
    '0901',
    '0902',
    '0904',
    '0907',
    '0912',
  ];

  // Glo prefixes
  const gloPrefixes = ['0705', '0805', '0807', '0811', '0815', '0905', '0915'];

  // 9Mobile prefixes
  const mobile9Prefixes = ['0809', '0817', '0818', '0908', '0909'];

  const prefix = number.substring(0, 4);

  if (mtnPrefixes.includes(prefix)) return NetworkProvider.MTN;
  if (airtelPrefixes.includes(prefix)) return NetworkProvider.AIRTEL;
  if (gloPrefixes.includes(prefix)) return NetworkProvider.GLO;
  if (mobile9Prefixes.includes(prefix)) return NetworkProvider.MOBILE_9;

  return null;
}

/**
 * Format phone number for Kuda API
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Convert international format to local
  if (cleaned.startsWith('234')) {
    cleaned = `0${cleaned.substring(3)}`;
  }

  // Ensure it starts with 0
  if (!cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = `0${cleaned}`;
  }

  return cleaned;
}

/**
 * Validate phone number
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const formatted = formatPhoneNumber(phoneNumber);
  return /^0[789][01]\d{8}$/.test(formatted);
}

/**
 * Get airtime denominations for quick purchase
 */
export function getAirtimeDenominations(): number[] {
  return [100, 200, 500, 1000, 2000, 5000];
}

/**
 * Kuda commission rates by provider and category
 * Source: Kuda VTU documentation
 */
export const KUDA_COMMISSION_RATES: Record<
  string,
  { rate: number; cap?: number }
> = {
  // Airtime
  MTN_AIRTIME: { rate: 0.03 },
  AIRTEL_AIRTIME: { rate: 0.03 },
  GLO_AIRTIME: { rate: 0.04 },
  '9MOBILE_AIRTIME': { rate: 0.05 },

  // Data
  MTN_DATA: { rate: 0.03 },
  AIRTEL_DATA: { rate: 0.03 },
  GLO_DATA: { rate: 0.04 },
  '9MOBILE_DATA': { rate: 0.05 },
  SPECTRANET_DATA: { rate: 0.02 },
  SMILE_DATA: { rate: 0.02 },

  // Cable TV
  DSTV: { rate: 0.016 },
  GOTV: { rate: 0.016 },
  STARTIMES: { rate: 0.012 },
  SHOWMAX: { rate: 0.02 },

  // Electricity
  AEDC: { rate: 0.012 },
  EEDC: { rate: 0.012, cap: 2500 },
  KAEDCO: { rate: 0.012 },
  PHEDC: { rate: 0.012 },
  JEDC: { rate: 0.01 },
  IBEDC: { rate: 0.01 },
  IKEDC: { rate: 0.008 },
  EKEDC: { rate: 0.01, cap: 4000 },
  BEDC: { rate: 0.012 },
  KEDCO: { rate: 0.01 },

  // Default fallback
  DEFAULT: { rate: 0.02 },
};

/**
 * Get commission rate for a provider
 * @deprecated Use the centralized Commerce Brain Edge Function instead.
 * This function is kept for backward compatibility but will be removed in a future version.
 * Use calculateCommerce('calculate_vtu', {...}) from @/lib/supabase/client
 */
export function getCommissionRate(
  provider: string,
  category: 'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'CABLE' = 'AIRTIME'
): { rate: number; cap?: number } {
  const key = `${provider.toUpperCase()}_${category}`;
  return (
    KUDA_COMMISSION_RATES[key] ||
    KUDA_COMMISSION_RATES[provider.toUpperCase()] ||
    KUDA_COMMISSION_RATES.DEFAULT
  );
}

/**
 * Calculate platform commission on VTU
 *
 * Commission split:
 * - Merchant gets 50% of Kuda commission
 * - Platform (Baci) gets 50% of Kuda commission
 *
 * Example: ₦1,000 MTN airtime (3% = ₦30 commission)
 * - Merchant earns: ₦15
 * - Platform earns: ₦15
 *
 * @deprecated Use the centralized Commerce Brain Edge Function instead.
 * This function is kept for backward compatibility but will be removed in a future version.
 * Use calculateCommerce('calculate_vtu', {...}) from @/lib/supabase/client
 */
export function calculateVTUCommission(
  amount: number,
  provider: NetworkProvider,
  category: 'AIRTIME' | 'DATA' = 'AIRTIME',
  merchantSplitPercentage: number = 50 // Merchant gets 50% of commission by default
): {
  platformEarning: number;
  merchantEarning: number;
  totalCommission: number;
  commissionRate: number;
} {
  const { rate, cap } = getCommissionRate(provider, category);

  // Calculate total commission from Kuda
  let totalCommission = amount * rate;

  // Apply cap if exists
  if (cap && totalCommission > cap) {
    totalCommission = cap;
  }

  // Split between merchant and platform
  const merchantEarning = totalCommission * (merchantSplitPercentage / 100);
  const platformEarning = totalCommission - merchantEarning;

  return {
    platformEarning: Math.round(platformEarning * 100) / 100,
    merchantEarning: Math.round(merchantEarning * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    commissionRate: rate * 100, // Return as percentage
  };
}
