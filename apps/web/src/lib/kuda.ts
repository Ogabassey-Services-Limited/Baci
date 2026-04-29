/**
 * Kuda Open API Client Library
 * Provides VTU (Value Top-Up) services: Airtime, Data, Bills
 *
 * API Documentation: https://docs.kuda.com/
 */

import crypto from 'node:crypto';

export { detectNetworkProvider } from './detect-network-provider';

// Environment configuration
const KUDA_API_BASE_URL =
  process.env.KUDA_API_BASE_URL || 'https://kuda-openapi.kuda.com/v2.1';
const KUDA_EMAIL = process.env.KUDA_EMAIL || '';
const KUDA_API_KEY = process.env.KUDA_API_KEY || '';
const KUDA_REQUEST_TIMEOUT_MS = 15000;

// Service Types for Kuda API
export enum KudaServiceType {
  // Authentication
  GET_TOKEN = 'GET_TOKEN',

  // Bill Services
  GET_BILLERS = 'GET_BILLERS',
  GET_BILLERS_BY_TYPE = 'GET_BILLERS_BY_TYPE',
  VERIFY_BILL_CUSTOMER = 'VERIFY_BILL_CUSTOMER',
  ADMIN_PURCHASE_BILL = 'ADMIN_PURCHASE_BILL',
  PURCHASE_BILL = 'PURCHASE_BILL',
  BILL_TSQ = 'BILL_TSQ', // Transaction status query
  ADMIN_GET_PURCHASED_BILLS = 'ADMIN_GET_PURCHASED_BILLS',
  GET_PURCHASED_BILLS = 'GET_PURCHASED_BILLS',

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

// Biller Information (normalized from Kuda's PascalCase response)
export interface Biller {
  billerId: string;
  billerName: string;
  billerType: string;
  categoryId: string;
  categoryName: string;
  billerIconUrl?: string;
  billItems?: BillItem[];
}

/**
 * Raw biller shape returned by Kuda API (PascalCase).
 * See: https://docs.kuda.com/ — GET_BILLERS_BY_TYPE
 */
interface KudaRawBiller {
  Id: string;
  Name: string;
  Description: string;
  BillerIconUrl?: string;
  BillTypeId: string;
  BillItems?: unknown[];
}

interface KudaRawBillItem {
  ItemCode?: string;
  itemCode?: string;
  KudaIdentifier?: string;
  kudaIdentifier?: string;
  ItemName?: string;
  itemName?: string;
  Name?: string;
  name?: string;
  Amount?: number | string;
  amount?: number | string;
  ItemCurrencySymbol?: string;
  itemCurrencySymbol?: string;
  IsAmountFixed?: boolean;
  isAmountFixed?: boolean;
  IsFixedPrice?: boolean;
  isFixedPrice?: boolean;
  ItemFee?: number | string;
  itemFee?: number | string;
  BillItems?: unknown[];
  billItems?: unknown[];
}

function toNumber(value: number | string | undefined, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function mapBillItem(raw: unknown): BillItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = raw as KudaRawBillItem;
  const itemCode =
    item.ItemCode ??
    item.itemCode ??
    item.KudaIdentifier ??
    item.kudaIdentifier;
  const itemName = item.ItemName ?? item.itemName ?? item.Name ?? item.name;

  if (!itemCode || !itemName) {
    return null;
  }

  return {
    itemCode,
    itemName,
    amount: toNumber(item.Amount ?? item.amount),
    itemCurrencySymbol:
      item.ItemCurrencySymbol ?? item.itemCurrencySymbol ?? 'NGN',
    isAmountFixed:
      item.IsAmountFixed ??
      item.isAmountFixed ??
      item.IsFixedPrice ??
      item.isFixedPrice ??
      false,
    itemFee: toNumber(item.ItemFee ?? item.itemFee),
    billItems: mapBillItems(item.BillItems ?? item.billItems),
  };
}

function mapBillItems(rawItems: unknown[] | undefined): BillItem[] | undefined {
  if (!rawItems || rawItems.length === 0) {
    return undefined;
  }

  const billItems = rawItems
    .map((rawItem) => mapBillItem(rawItem))
    .filter((item): item is BillItem => item !== null);

  return billItems.length > 0 ? billItems : undefined;
}

/**
 * Map a raw Kuda biller (PascalCase) to our normalized Biller interface.
 */
function mapKudaBiller(raw: KudaRawBiller, categoryName: string): Biller {
  return {
    billerId: raw.Id,
    billerName: raw.Name,
    billerType: raw.Description,
    categoryId: raw.BillTypeId,
    categoryName,
    billerIconUrl: raw.BillerIconUrl,
    billItems: mapBillItems(raw.BillItems),
  };
}

// Bill Item (specific product from a biller)
export interface BillItem {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  billItems?: BillItem[];
}

// Purchase Result
export interface PurchaseResult {
  success: boolean;
  reference: string;
  transactionId?: string;
  pin?: string | null;
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

interface KudaTransactionStatusData {
  finalStatus?: string;
  FinalStatus?: string;
  transactionStatus?: number | string;
  TransactionStatus?: number | string;
  postingStatus?: number | string;
  PostingStatus?: number | string;
  status?: number | string;
  Status?: number | string;
  message?: string;
  Message?: string;
  pin?: number | string | null;
  Pin?: number | string | null;
  PIN?: number | string | null;
  token?: number | string | null;
  Token?: number | string | null;
  meterToken?: number | string | null;
  MeterToken?: number | string | null;
  vendCode?: number | string | null;
  VendCode?: number | string | null;
  voucher?: number | string | null;
  Voucher?: number | string | null;
}

type KudaTransactionStatusResult = {
  message: string;
  pin?: string;
  status: string;
};

// Token storage (in production, use Redis or database)
let cachedToken: { token: string; expiresAt: number } | null = null;

function normalizeKudaString(value: number | string | null | undefined) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function extractKudaVoucherPin(data: KudaTransactionStatusData | undefined) {
  if (!data) {
    return undefined;
  }

  return (
    normalizeKudaString(data.pin) ??
    normalizeKudaString(data.Pin) ??
    normalizeKudaString(data.PIN) ??
    normalizeKudaString(data.token) ??
    normalizeKudaString(data.Token) ??
    normalizeKudaString(data.meterToken) ??
    normalizeKudaString(data.MeterToken) ??
    normalizeKudaString(data.vendCode) ??
    normalizeKudaString(data.VendCode) ??
    normalizeKudaString(data.voucher) ??
    normalizeKudaString(data.Voucher)
  );
}

function extractKudaStatus(data: KudaTransactionStatusData | undefined) {
  if (!data) {
    return 'unknown';
  }

  return (
    normalizeKudaString(data.finalStatus) ??
    normalizeKudaString(data.FinalStatus) ??
    normalizeKudaString(data.transactionStatus) ??
    normalizeKudaString(data.TransactionStatus) ??
    normalizeKudaString(data.postingStatus) ??
    normalizeKudaString(data.PostingStatus) ??
    normalizeKudaString(data.status) ??
    normalizeKudaString(data.Status) ??
    'unknown'
  );
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

/**
 * Generate a provider-safe request reference.
 * Kuda bill purchases are sensitive to punctuation-heavy refs.
 */
export function generateRequestRef(): string {
  return crypto.randomBytes(12).toString('hex');
}

/**
 * Get authentication token from Kuda
 */
async function getToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const { signal, cleanup } = createTimeoutSignal(KUDA_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${KUDA_API_BASE_URL}/Account/GetToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: KUDA_EMAIL,
        apiKey: KUDA_API_KEY,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Kuda authentication request timed out');
    }

    throw error;
  } finally {
    cleanup();
  }

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
 * Make authenticated request to Kuda API.
 *
 * Kuda's response envelope uses inconsistent casing across endpoints
 * (e.g. `Status` vs `status`, `Data` vs `data`). This function normalizes
 * the outer envelope to consistent camelCase before returning.
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
    Data: data,
  };

  const { signal, cleanup } = createTimeoutSignal(KUDA_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(KUDA_API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Kuda ${serviceType} request timed out`);
    }

    throw error;
  } finally {
    cleanup();
  }

  if (!response.ok) {
    throw new Error(`Kuda API request failed: ${response.statusText}`);
  }

  const raw = await response.json();

  // Normalize Kuda's mixed-case envelope (Status/status, Message/message, Data/data).
  // Some endpoints (e.g. VERIFY_BILL_CUSTOMER) return BOTH `data` and `Data` with
  // different payloads — merge them so callers see all fields.
  const lowerData = raw.data as Record<string, unknown> | undefined;
  const upperData = raw.Data as Record<string, unknown> | undefined;
  const mergedData =
    lowerData && upperData
      ? { ...lowerData, ...upperData }
      : (lowerData ?? upperData);

  return {
    status: raw.status ?? raw.Status ?? false,
    message: raw.message ?? raw.Message ?? '',
    data: mergedData as T | undefined,
  };
}

// ============================================
// AIRTIME & DATA SERVICES
// ============================================

/**
 * Get all available billers across all categories.
 *
 * Uses GET_BILLERS service type. Kuda returns:
 * { billers: [{ id, name, description, billerIconUrl, billTypeId, isActive }] }
 * Note: GET_BILLERS uses camelCase (unlike GET_BILLERS_BY_TYPE which uses PascalCase).
 */
export async function getBillTypes(): Promise<Biller[]> {
  const response = await kudaRequest<{
    billers?: Array<{
      id: string;
      name: string;
      description: string;
      billerIconUrl?: string;
      billTypeId: string;
      isActive?: boolean;
    }>;
  }>(KudaServiceType.GET_BILLERS);

  const rawBillers = response.data?.billers || [];
  return rawBillers.map((raw) => ({
    billerId: raw.id,
    billerName: raw.name,
    billerType: raw.description,
    categoryId: raw.billTypeId,
    categoryName: '',
    billerIconUrl: raw.billerIconUrl,
  }));
}

/**
 * Get billers by type (e.g., all electricity providers).
 *
 * Kuda returns camelCase fields: { billers: [{ id, name, description, ... }] }.
 * We normalize to our Biller interface.
 */
export async function getBillersByType(
  billTypeName: string
): Promise<Biller[]> {
  const response = await kudaRequest<{
    billers?: Array<{
      id: string;
      name: string;
      description: string;
      billerIconUrl?: string;
      billTypeId: string;
      billItems?: unknown[];
    }>;
    Billers?: KudaRawBiller[];
  }>(KudaServiceType.GET_BILLERS_BY_TYPE, { BillTypeName: billTypeName });

  // Handle both camelCase (production) and PascalCase (legacy/test) responses
  const camelBillers = response.data?.billers;
  if (camelBillers && camelBillers.length > 0) {
    return camelBillers.map((raw) => ({
      billerId: raw.id,
      billerName: raw.name,
      billerType: raw.description,
      categoryId: raw.billTypeId,
      categoryName: billTypeName,
      billerIconUrl: raw.billerIconUrl,
      billItems: mapBillItems(raw.billItems),
    }));
  }

  const pascalBillers = response.data?.Billers;
  if (pascalBillers && pascalBillers.length > 0) {
    return pascalBillers.map((raw) => mapKudaBiller(raw, billTypeName));
  }

  return [];
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
 * Verify a customer before bill purchase.
 *
 * Kuda verify response (from docs):
 * { data: { StatusCode, Status, Message }, Data: { CustomerName } }
 * The outer envelope is normalized by kudaRequest. The customer name
 * may appear as `CustomerName` (PascalCase) in the data payload.
 */
export async function verifyBillCustomer(
  kudaBillItemIdentifier: string,
  customerIdentification: string
): Promise<{ verified: boolean; customerName?: string; message: string }> {
  try {
    const response = await kudaRequest<{
      CustomerName?: string;
      customerName?: string;
    }>(KudaServiceType.VERIFY_BILL_CUSTOMER, {
      KudaBillItemIdentifier: kudaBillItemIdentifier,
      CustomerIdentification: customerIdentification,
    });

    const customerName =
      response.data?.CustomerName ?? response.data?.customerName;

    return {
      verified: response.status && !!customerName,
      customerName,
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
 * Purchase airtime using the primary (admin) account.
 * @param customerName - Customer's name for the Kuda transaction record.
 */
export async function purchaseAirtime(
  phoneNumber: string,
  amount: number,
  networkProvider: NetworkProvider,
  customerName: string = 'Customer',
  requestRef?: string
): Promise<PurchaseResult> {
  const reference = requestRef || generateRequestRef();

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
      reference,
      message: `Invalid network provider: ${networkProvider}`,
      status: 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  }

  try {
    // Kuda purchase response: { reference: string; pin: string | null }
    const response = await kudaRequest<{
      Reference?: string;
      Pin?: string | null;
      reference: string;
      pin: string | null;
    }>(
      KudaServiceType.ADMIN_PURCHASE_BILL,
      {
        CustomerFirstName: customerName,
        CustomerIdentifier: phoneNumber,
        PhoneNumber: phoneNumber,
        BillItemIdentifier: billItemIdentifier,
        Amount: (amount * 100).toString(), // Convert Naira to Kobo
        trackingReference: reference,
      },
      reference
    );

    const pin = extractKudaVoucherPin(response.data);

    return {
      success: response.status,
      reference,
      transactionId: response.data?.reference ?? response.data?.Reference,
      ...(pin && { pin }),
      message: response.message,
      status: response.status ? 'successful' : 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  } catch (error) {
    return {
      success: false,
      reference,
      message: error instanceof Error ? error.message : 'Purchase failed',
      status: 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  }
}

/**
 * Purchase data bundle.
 * @param customerName - Customer's name for the Kuda transaction record.
 */
export async function purchaseData(
  phoneNumber: string,
  dataPlanCode: string,
  amount: number,
  networkProvider: NetworkProvider,
  customerName: string = 'Customer',
  requestRef?: string
): Promise<PurchaseResult> {
  const reference = requestRef || generateRequestRef();

  try {
    // Kuda purchase response: { reference: string; pin: string | null }
    const response = await kudaRequest<{
      Reference?: string;
      Pin?: string | null;
      reference: string;
      pin: string | null;
    }>(
      KudaServiceType.ADMIN_PURCHASE_BILL,
      {
        CustomerFirstName: customerName,
        CustomerIdentifier: phoneNumber,
        PhoneNumber: phoneNumber,
        BillItemIdentifier: dataPlanCode,
        Amount: (amount * 100).toString(), // Convert Naira to Kobo
        trackingReference: reference,
      },
      reference
    );

    const pin = extractKudaVoucherPin(response.data);

    return {
      success: response.status,
      reference,
      transactionId: response.data?.reference ?? response.data?.Reference,
      ...(pin && { pin }),
      message: response.message,
      status: response.status ? 'successful' : 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  } catch (error) {
    return {
      success: false,
      reference,
      message: error instanceof Error ? error.message : 'Purchase failed',
      status: 'failed',
      amount,
      phoneNumber,
      provider: networkProvider,
    };
  }
}

/**
 * Check transaction status (BILL_TSQ).
 *
 * Kuda docs: pass EITHER BillResponseReference OR BillRequestRef, not both.
 * Prefer BillResponseReference when available.
 *
 * Kuda returns: { finalStatus, transactionStatus, postingStatus, pin, ... }
 */
export async function checkTransactionStatus(
  billResponseReference?: string,
  billRequestRef?: string
): Promise<KudaTransactionStatusResult> {
  if (!billResponseReference && !billRequestRef) {
    return { status: 'failed', message: 'No reference provided' };
  }

  const statusQueries: Record<string, unknown>[] = [];
  if (billResponseReference) {
    statusQueries.push({ BillResponseReference: billResponseReference });
  }
  if (billRequestRef) {
    statusQueries.push({ BillRequestRef: billRequestRef });
  }

  let message = '';
  let status = 'unknown';
  let lastError: unknown;
  let querySucceeded = false;

  for (const data of statusQueries) {
    let response: KudaApiResponse<KudaTransactionStatusData>;
    try {
      response = await kudaRequest<KudaTransactionStatusData>(
        KudaServiceType.BILL_TSQ,
        data
      );
    } catch (error) {
      lastError = error;
      continue;
    }

    querySucceeded = true;
    message = response.message || message;

    const nextStatus = extractKudaStatus(response.data);
    if (status === 'unknown' && nextStatus !== 'unknown') {
      status = nextStatus;
    }

    const pin = extractKudaVoucherPin(response.data);
    if (pin) {
      return {
        message,
        pin,
        status: nextStatus === 'unknown' ? status : nextStatus,
      };
    }
  }

  if (!querySucceeded && lastError) {
    throw lastError;
  }

  return { status, message };
}

/**
 * Get purchased bills history.
 *
 * Kuda returns: { billPayments: [...] }
 */
export async function getPurchasedBills(): Promise<{
  bills: unknown[];
}> {
  const response = await kudaRequest<{
    billPayments?: unknown[];
  }>(KudaServiceType.ADMIN_GET_PURCHASED_BILLS, {});

  return {
    bills: response.data?.billPayments || [],
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
