import { createHash } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { parseSickwResponse } from '@/app/api/storefront/imei-check/sickw-parser';
import type { ImeiCheckResult } from '@/app/api/storefront/imei-check/sickw-parser.types';
import { getDeviceImage } from '@/lib/device-images';
import type { createAdminClient } from '@/lib/supabase/admin';
import { isInsufficientWalletBalanceError } from '@/lib/vtu-fulfillment';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';

const SICKW_API_URL = 'https://sickw.com/api.php';
const SICKW_REQUEST_TIMEOUT_MS = 15_000;

export interface ImeiCustomerRecord {
  email: string | null;
  first_name: string | null;
  id: string;
  last_name: string | null;
  phone: string | null;
  user_id: string | null;
}

export type ImeiLookupResponseBody =
  | {
      data: ImeiCheckResult;
      success: true;
      tier: { checksIncluded: readonly string[]; name: string };
    }
  | {
      balance?: number;
      code: string;
      error: string;
      required?: number;
      success: false;
    };

export type SickwLookupResult =
  | {
      body: ImeiLookupResponseBody;
      ok: true;
      rawResponseText: string;
      sickwStatus: string;
      status: 200;
    }
  | {
      body: ImeiLookupResponseBody;
      ok: false;
      rawResponseText?: string;
      refundReason: 'error' | 'not_found';
      sickwStatus: string;
      status: 404 | 502;
    };

export async function resolveImeiCustomer({
  merchantId,
  supabase,
  user,
}: {
  merchantId: string;
  supabase: SupabaseClient;
  user: User;
}): Promise<ImeiCustomerRecord | null> {
  return (await resolveVtuCustomer({
    merchantId,
    supabase,
    user,
  })) as ImeiCustomerRecord | null;
}

export async function readCustomerWalletBalance({
  customerId,
  merchantId,
  supabase,
}: {
  customerId: string;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<number> {
  const { data, error } = await supabase
    .from('customer_wallets')
    .select('available_balance')
    .eq('customer_id', customerId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read customer wallet balance: ${error.message}`);
  }

  return coerceNumber(data?.available_balance);
}

/** Requires a service-role/admin Supabase client because the RPC is privileged. */
export async function redeemImeiWalletPayment({
  amount,
  customerId,
  lookupId,
  merchantId,
  supabaseAdmin,
}: {
  amount: number;
  customerId: string;
  lookupId: string;
  merchantId: string;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
}) {
  const { error } = await supabaseAdmin.rpc('redeem_imei_wallet_payment', {
    p_amount: amount,
    p_customer_id: customerId,
    p_description: `IMEI lookup payment: ${lookupId}`,
    p_lookup_id: lookupId,
    p_merchant_id: merchantId,
  });

  if (error) {
    throw error;
  }
}

/** Requires a service-role/admin Supabase client because the RPC is privileged. */
export async function refundImeiWalletPayment({
  amount,
  customerId,
  lookupId,
  merchantId,
  supabaseAdmin,
}: {
  amount: number;
  customerId: string;
  lookupId: string;
  merchantId: string;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
}) {
  const { error } = await supabaseAdmin.rpc('refund_imei_wallet_payment', {
    p_amount: amount,
    p_customer_id: customerId,
    p_description: `IMEI lookup refund: ${lookupId}`,
    p_lookup_id: lookupId,
    p_merchant_id: merchantId,
  });

  if (error) {
    throw error;
  }
}

export { isInsufficientWalletBalanceError };

export function hashProviderResponse(rawResponseText: string): string {
  return createHash('sha256').update(rawResponseText).digest('hex');
}

export async function requestSickwCheck({
  apiKey,
  checksIncluded,
  imei,
  serviceId,
  tierName,
}: {
  apiKey: string;
  checksIncluded: readonly string[];
  imei: string;
  serviceId: string;
  tierName: string;
}): Promise<SickwLookupResult> {
  const params = new URLSearchParams({
    format: 'json',
    imei,
    key: apiKey,
    service: serviceId,
  });

  let response: Response;
  try {
    response = await fetch(`${SICKW_API_URL}?${params.toString()}`, {
      headers: { 'User-Agent': 'Baci-IMEI-Checker/1.0' },
      method: 'GET',
      signal: AbortSignal.timeout(SICKW_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError');
    console.error(
      '[IMEI Check] SICKW request failed:',
      isTimeout ? 'timeout' : error
    );
    return providerUnavailable();
  }

  const rawResponseText = await response.text();
  if (!response.ok) {
    console.error('[IMEI Check] SICKW API error:', response.status);
    return providerUnavailable(rawResponseText, `http_${response.status}`);
  }

  const payload = parseProviderPayload(rawResponseText);
  const providerError = getProviderError(payload);
  if (providerError) {
    return providerErrorToResult(providerError, rawResponseText);
  }

  const resultText = normalizeResult(payload.result ?? payload.data ?? payload);
  const parsed = parseSickwResponse(resultText);
  const device = parsed.device || '';
  const result: ImeiCheckResult = {
    imei,
    device: device || 'Unknown Device',
    modelNumber: parsed.modelNumber || '',
    status: parsed.status || 'Unknown',
    icloud: parsed.icloud || 'Unknown',
    icloudLock: parsed.icloudLock || 'Unknown',
    simLock: parsed.simLock || 'Unknown',
    blacklistStatus: parsed.blacklistStatus || 'Unknown',
    carrier: parsed.carrier || 'Unknown',
    deviceImage: getDeviceImage(device),
    score: parsed.score || 50,
    activationStatus: parsed.activationStatus,
    serialNumber: parsed.serialNumber,
    purchaseDate: parsed.purchaseDate,
    purchaseCountry: parsed.purchaseCountry,
    warranty: parsed.warranty,
    refurbished: parsed.refurbished,
    demoUnit: parsed.demoUnit,
    mdmStatus: parsed.mdmStatus,
    miLockStatus: parsed.miLockStatus,
    miLostStatus: parsed.miLostStatus,
    deviceType: parsed.deviceType || 'other',
    verdict: parsed.verdict || 'Unable to determine device status.',
    verdictType: parsed.verdictType || 'caution',
    rawResponse:
      process.env.NODE_ENV === 'development'
        ? JSON.stringify(payload)
        : undefined,
  };

  return {
    body: {
      success: true,
      data: result,
      tier: { checksIncluded, name: tierName },
    },
    ok: true,
    rawResponseText,
    sickwStatus: 'success',
    status: 200,
  };
}

function providerUnavailable(
  rawResponseText?: string,
  sickwStatus = 'unavailable'
): SickwLookupResult {
  return {
    body: {
      success: false,
      error: 'Lookup failed; your wallet was refunded.',
      code: 'SICKW_UNAVAILABLE',
    },
    ok: false,
    rawResponseText,
    refundReason: 'error',
    sickwStatus,
    status: 502,
  };
}

function providerErrorToResult(
  errorMessage: string,
  rawResponseText: string
): SickwLookupResult {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes('invalid') || normalized.includes('not found')) {
    return {
      body: {
        success: false,
        error: 'IMEI result was not found; your wallet was refunded.',
        code: 'SICKW_NOT_FOUND',
      },
      ok: false,
      rawResponseText,
      refundReason: 'not_found',
      sickwStatus: 'not_found',
      status: 404,
    };
  }

  return providerUnavailable(rawResponseText, 'provider_error');
}

function parseProviderPayload(rawText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    console.warn('[IMEI Check] Response is not JSON, treating as text');
  }

  return { result: rawText };
}

function normalizeResult(result: unknown): string | Record<string, unknown> {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object') {
    return result as Record<string, unknown>;
  }

  return '';
}

function getProviderError(payload: Record<string, unknown>): string | null {
  const result = payload.result;
  const isErrorObject = payload.status === 'error' || Boolean(payload.error);
  const isErrorString =
    typeof result === 'string' && result.toLowerCase().startsWith('error');

  if (!isErrorObject && !isErrorString) {
    return null;
  }

  const errorValue = payload.message ?? payload.error ?? result;
  return typeof errorValue === 'string' ? errorValue : 'Check failed';
}

function coerceNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
