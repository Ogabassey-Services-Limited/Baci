import {
  IMEI_SERVICE_TIERS,
  PRIMARY_IMEI_SERVICE_TIERS,
} from '@baci/shared/imei';
import type { NextRequest } from 'next/server';
import { getImeiHashSalt, getRootDomain, getSickwApiKey } from '@/env';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  isInsufficientWalletBalanceError,
  readCustomerWalletBalance,
  redeemImeiWalletPayment,
  requestSickwCheck,
  resolveImeiCustomer,
} from '@/lib/imei-lookup-fulfillment';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';
import { createAdminClient } from '@/lib/supabase/admin';
import { imeiCheckSchema } from '@/schemas/imei-check';
import {
  cacheInsufficientBalanceResponse,
  cacheSuccessfulLookup,
  errorBody,
  findLookupByIdempotencyKey,
  hashImei,
  isUniqueViolation,
  isValidImeiChecksum,
  json,
  mapExistingLookup,
  mapExistingTerminalLookupWithoutImeiHash,
  refundAndCacheFailure,
  UUID_PATTERN,
} from './route-helpers';

const PUBLIC_IMEI_SERVICE_TIER_KEYS = new Set<string>(
  PRIMARY_IMEI_SERVICE_TIERS
);

export async function POST(request: NextRequest) {
  let activeLookup: {
    amount: number;
    customerId: string;
    id: string;
    merchantId: string;
  } | null = null;
  let debitSucceeded = false;

  try {
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit.limit,
        rateLimit.remaining,
        rateLimit.resetTime
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user) {
      return json(
        errorBody({ code: 'AUTH_REQUIRED', error: 'Unauthorized' }),
        401
      );
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        json(
          errorBody({ code: 'CSRF_INVALID', error: 'CSRF validation failed' }),
          403
        )
      );
    }

    const merchantResolution = await resolveStorefrontMerchantFromRequest({
      lookupError: 'Failed to validate storefront host',
      notFoundError: 'IMEI check is only available on storefront hosts',
      request,
      rootDomain: getRootDomain() || 'usebaci.com',
    });
    if (!merchantResolution.success) {
      return json(
        errorBody({
          code: 'STOREFRONT_NOT_FOUND',
          error: merchantResolution.error,
        }),
        merchantResolution.status
      );
    }
    const merchantId = String(merchantResolution.merchant.id);

    const rawIdempotencyKey = request.headers.get('Idempotency-Key') ?? '';
    if (!rawIdempotencyKey || !UUID_PATTERN.test(rawIdempotencyKey)) {
      return json(
        errorBody({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          error: 'Missing or invalid Idempotency-Key header.',
        }),
        400
      );
    }
    const idempotencyKey = rawIdempotencyKey.toLowerCase();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return json(
        errorBody({ code: 'INVALID_JSON', error: 'Invalid JSON' }),
        400
      );
    }

    const bodyParse = imeiCheckSchema.safeParse(rawBody);
    if (!bodyParse.success) {
      return json(
        errorBody({
          code: 'INVALID_REQUEST_BODY',
          error: 'Invalid request body',
        }),
        400
      );
    }
    const requestedTier = bodyParse.data.tier;
    if (!PUBLIC_IMEI_SERVICE_TIER_KEYS.has(requestedTier)) {
      return json(
        errorBody({
          code: 'IMEI_TIER_NOT_AVAILABLE',
          error: 'Selected IMEI service tier is not available.',
        }),
        400
      );
    }

    if (!isValidImeiChecksum(bodyParse.data.imei)) {
      return json(
        errorBody({ code: 'INVALID_IMEI', error: 'Invalid IMEI checksum' }),
        400
      );
    }

    const supabase = createAdminClient();
    const customer = await resolveImeiCustomer({
      merchantId,
      supabase,
      user: auth.user,
    });
    if (!customer) {
      return json(
        errorBody({
          code: 'CUSTOMER_NOT_FOUND',
          error: 'Customer account not found for this storefront',
        }),
        404
      );
    }

    const hashSalt = getImeiHashSalt();
    if (!hashSalt) {
      const existingLookup = await findLookupByIdempotencyKey(
        supabase,
        idempotencyKey
      );
      if (existingLookup) {
        return mapExistingTerminalLookupWithoutImeiHash(existingLookup, {
          customerId: customer.id,
          merchantId,
          tier: requestedTier,
        });
      }

      console.error('[IMEI Check] IMEI_HASH_SALT is not configured');
      return json(
        errorBody({
          code: 'IMEI_HASH_SALT_MISSING',
          error: 'IMEI lookup is temporarily unavailable',
        }),
        503
      );
    }
    const imeiHash = hashImei(bodyParse.data.imei, hashSalt);

    const replayContext = {
      customerId: customer.id,
      imeiHash,
      merchantId,
      tier: requestedTier,
    };
    const existingLookup = await findLookupByIdempotencyKey(
      supabase,
      idempotencyKey
    );
    if (existingLookup) {
      return mapExistingLookup(existingLookup, replayContext);
    }

    const sickwApiKey = getSickwApiKey();
    if (!sickwApiKey) {
      console.error('[IMEI Check] SICKW_API_KEY is not configured');
      return json(
        errorBody({
          code: 'SICKW_API_KEY_MISSING',
          error: 'IMEI lookup is temporarily unavailable',
        }),
        503
      );
    }

    const serviceTier = IMEI_SERVICE_TIERS[requestedTier];
    const amount = serviceTier.price;
    const { data: insertedLookup, error: insertError } = await supabase
      .from('imei_lookups')
      .insert({
        amount_ngn: amount,
        customer_id: customer.id,
        idempotency_key: idempotencyKey,
        imei_hash: imeiHash,
        merchant_id: merchantId,
        status: 'pending',
        tier: requestedTier,
      })
      .select('id')
      .single();

    if (insertError) {
      if (isUniqueViolation(insertError)) {
        const winningLookup = await findLookupByIdempotencyKey(
          supabase,
          idempotencyKey
        );
        if (winningLookup) {
          return mapExistingLookup(winningLookup, replayContext);
        }
      }
      throw new Error(
        `Failed to create IMEI lookup row: ${insertError.message}`
      );
    }

    activeLookup = {
      amount,
      customerId: customer.id,
      id: String(insertedLookup.id),
      merchantId,
    };

    const preflightBalance = await readCustomerWalletBalance({
      customerId: customer.id,
      merchantId,
      supabase,
    });

    try {
      await redeemImeiWalletPayment({
        amount,
        customerId: customer.id,
        lookupId: activeLookup.id,
        merchantId,
        supabaseAdmin: supabase,
      });
      debitSucceeded = true;
    } catch (error) {
      if (
        !isInsufficientWalletBalanceError(
          error as { code?: string; message?: string } | null | undefined
        )
      ) {
        throw error;
      }
      return await cacheInsufficientBalanceResponse({
        amount,
        customerId: customer.id,
        lookupId: activeLookup.id,
        merchantId,
        preflightBalance,
        supabase,
      });
    }

    const providerStartedAt = Date.now();
    const providerResult = await requestSickwCheck({
      apiKey: sickwApiKey,
      checksIncluded: serviceTier.checksIncluded,
      imei: bodyParse.data.imei,
      serviceId: serviceTier.providerServiceId,
      tierName: serviceTier.name,
    });
    const providerLatencyMs = Date.now() - providerStartedAt;

    if (providerResult.ok) {
      return await cacheSuccessfulLookup({
        amount,
        customerId: customer.id,
        latencyMs: providerLatencyMs,
        lookupId: activeLookup.id,
        merchantId,
        providerResult,
        supabase,
        tier: requestedTier,
      });
    }

    return await refundAndCacheFailure({
      amount,
      body: providerResult.body,
      customerId: customer.id,
      lookupId: activeLookup.id,
      merchantId,
      refundSuccessStatus:
        providerResult.refundReason === 'not_found'
          ? 'refunded_not_found'
          : 'refunded_error',
      sickwStatus: providerResult.sickwStatus,
      status: providerResult.status,
      supabase,
    });
  } catch (error) {
    console.error('IMEI check error:', error);
    if (debitSucceeded && activeLookup) {
      const supabase = createAdminClient();
      return await refundAndCacheFailure({
        amount: activeLookup.amount,
        body: errorBody({
          code: 'SICKW_UNAVAILABLE',
          error: 'Lookup failed; your wallet was refunded.',
        }),
        customerId: activeLookup.customerId,
        lookupId: activeLookup.id,
        merchantId: activeLookup.merchantId,
        refundSuccessStatus: 'refunded_error',
        sickwStatus: 'unexpected_error',
        status: 502,
        supabase,
      });
    }

    return json(
      errorBody({ code: 'INTERNAL_ERROR', error: 'Internal server error' }),
      500
    );
  }
}
