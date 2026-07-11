import {
  IMEI_SERVICE_TIERS,
  type ImeiIdentifierType,
  type ImeiServiceTierKey,
  isValidDeviceIdentifier,
  normalizeDeviceIdentifier,
  PUBLIC_IMEI_SERVICE_TIERS,
} from '@baci/shared/imei';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import {
  getImeiDisabledTierKeys,
  getImeiHashSalt,
  getImeiIdentifierEncryptionKey,
  getPetrockConfig,
  getPetrockEnabledTierKeys,
  getRootDomain,
  getSickwApiKey,
  isPetrockEnabled,
} from '@/env';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  isInsufficientWalletBalanceError,
  readCustomerWalletBalance,
  redeemImeiWalletPayment,
  resolveImeiCustomer,
} from '@/lib/imei-lookup-fulfillment';
import { createPetrockClient } from '@/lib/imei-providers/petrock/petrock-client';
import {
  markPetrockSubmissionUnknown,
  readPetrockProductSnapshot,
} from '@/lib/imei-providers/petrock/petrock-lookup-state';
import { validatePetrockProductSnapshot } from '@/lib/imei-providers/petrock/petrock-preflight';
import { createPetrockProvider } from '@/lib/imei-providers/petrock/petrock-provider';
import { createImeiProviderRegistry } from '@/lib/imei-providers/registry';
import { createSickwProvider } from '@/lib/imei-providers/sickw-provider';
import { resolveImeiProviderBinding } from '@/lib/imei-providers/tier-bindings';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';
import { createAdminClient } from '@/lib/supabase/admin';
import { imeiCheckSchema } from '@/schemas/imei-check';
import {
  pendingPetrockResponse,
  submitPetrockLookup,
} from './petrock-submission-flow';
import {
  cacheInsufficientBalanceResponse,
  cacheLookupResponse,
  cacheSuccessfulLookup,
  refundAndCacheFailure,
} from './route-cache-helpers';
import {
  errorBody,
  findLookupByIdempotencyKey,
  hashImei,
  isUniqueViolation,
  json,
  mapExistingLookup,
  mapExistingTerminalLookupWithoutImeiHash,
  UUID_PATTERN,
} from './route-helpers';

const PUBLIC_IMEI_SERVICE_TIER_KEYS = new Set<string>(
  PUBLIC_IMEI_SERVICE_TIERS
);

const INVALID_IDENTIFIER_MESSAGE: Record<ImeiIdentifierType, string> = {
  imei: 'Invalid IMEI number',
  serial: 'Invalid serial number',
  both: 'Invalid IMEI or serial number',
};

export async function POST(request: NextRequest) {
  let activeLookup: {
    amount: number;
    customerId: string;
    id: string;
    merchantId: string;
    provider: 'petrock' | 'sickw';
  } | null = null;
  let debitSucceeded = false;
  let supabase: SupabaseClient | null = null;
  let supabaseAdmin: ReturnType<typeof createAdminClient> | null = null;

  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return json(
        errorBody({ code: 'AUTH_REQUIRED', error: 'Unauthorized' }),
        401
      );
    }
    supabase = auth.supabase;

    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit.limit,
        rateLimit.remaining,
        rateLimit.resetTime
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
    const deviceCategory = bodyParse.data.device;
    const clientSupportsAsync =
      bodyParse.data.clientCapabilities.includes('imei-async-v1');
    if (!PUBLIC_IMEI_SERVICE_TIER_KEYS.has(requestedTier)) {
      return json(
        errorBody({
          code: 'IMEI_TIER_NOT_AVAILABLE',
          error: 'Selected IMEI service tier is not available.',
        }),
        400
      );
    }

    const requestedIdentifier = IMEI_SERVICE_TIERS[requestedTier].identifier;
    // Validate the RAW submitted value first. Normalizing before validating
    // would silently truncate an over-length input (e.g. a 15-char serial
    // sliced to 14) into a spurious "valid" value that then bills a wallet
    // debit + paid provider call. Reject first, THEN normalize.
    if (!isValidDeviceIdentifier(bodyParse.data.imei, requestedIdentifier)) {
      return json(
        errorBody({
          code: 'INVALID_IMEI',
          error: INVALID_IDENTIFIER_MESSAGE[requestedIdentifier],
        }),
        400
      );
    }
    // Canonicalize (uppercase serials, strip separators) so replay hashing and
    // the provider call key off the same value — a mixed-case serial otherwise
    // hashes differently on replay. A raw-valid identifier has no separators
    // and is already within length, so this only case-folds it.
    const normalizedImei = normalizeDeviceIdentifier(
      bodyParse.data.imei,
      requestedIdentifier
    );

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

    // Provider metadata and IMEI hashes are intentionally hidden from the
    // authenticated table grant. All lookup replays are therefore read by the
    // server-only service-role client after customer authentication.
    supabaseAdmin = createAdminClient();

    const hashSalt = getImeiHashSalt();
    if (!hashSalt) {
      const existingLookup = await findLookupByIdempotencyKey(
        supabaseAdmin,
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
    const imeiHash = hashImei(normalizedImei, hashSalt);

    const replayContext = {
      customerId: customer.id,
      deviceCategory,
      imeiHash,
      merchantId,
      tier: requestedTier,
    };
    const existingLookup = await findLookupByIdempotencyKey(
      supabaseAdmin,
      idempotencyKey
    );
    if (existingLookup) {
      return mapExistingLookup(existingLookup, replayContext);
    }

    if (getImeiDisabledTierKeys().includes(requestedTier)) {
      return json(
        errorBody({
          code: 'IMEI_TIER_DISABLED',
          error: 'Selected IMEI service tier is temporarily unavailable',
        }),
        503
      );
    }

    const serviceTier = IMEI_SERVICE_TIERS[requestedTier];
    const binding = resolveImeiProviderBinding({
      clientSupportsAsync,
      deviceCategory,
      petrockEnabled: isPetrockEnabled(),
      petrockEnabledTiers: new Set(
        getPetrockEnabledTierKeys() as ImeiServiceTierKey[]
      ),
      tier: serviceTier,
      tierKey: requestedTier,
    });
    if (!binding) {
      return json(
        errorBody({
          code: 'IMEI_TIER_NOT_CONFIGURED',
          error: 'Selected IMEI service tier is not available.',
        }),
        503
      );
    }
    const sickwApiKey = getSickwApiKey();
    const sickwProvider = createSickwProvider({ apiKey: sickwApiKey });
    let petrockProvider: ReturnType<typeof createPetrockProvider> | undefined;
    let encryptionKey: string | undefined;

    if (binding.provider === 'petrock') {
      const petrockConfig = getPetrockConfig();
      encryptionKey = getImeiIdentifierEncryptionKey();
      if (!petrockConfig || !encryptionKey) {
        console.error('[IMEI Check] Petrock configuration is incomplete');
        return json(
          errorBody({
            code: 'PETROCK_CONFIG_MISSING',
            error: 'IMEI lookup is temporarily unavailable',
          }),
          503
        );
      }

      const snapshot = await readPetrockProductSnapshot({
        productId: binding.productId,
        supabaseAdmin,
      });
      const preflight = validatePetrockProductSnapshot({
        binding,
        now: new Date(),
        snapshot,
      });
      if (!preflight.ok) {
        console.error('[IMEI Check] Petrock preflight failed', {
          code: preflight.code,
          productId: binding.productId,
          tier: requestedTier,
        });
        return json(
          errorBody({ code: preflight.code, error: preflight.error }),
          503
        );
      }
      petrockProvider = createPetrockProvider({
        client: createPetrockClient(petrockConfig),
      });
    } else if (!sickwProvider.isConfigured()) {
      console.error('[IMEI Check] SICKW_API_KEY is not configured');
      return json(
        errorBody({
          code: 'SICKW_API_KEY_MISSING',
          error: 'IMEI lookup is temporarily unavailable',
        }),
        503
      );
    }

    const provider = createImeiProviderRegistry({
      petrock: petrockProvider,
      sickw: sickwProvider,
    }).get(binding.provider);
    if (!provider) {
      return json(
        errorBody({
          code: 'IMEI_PROVIDER_UNAVAILABLE',
          error: 'IMEI lookup is temporarily unavailable',
        }),
        503
      );
    }
    const amount = serviceTier.price;
    // H4: imei_lookups is a money/result table. Writes go through the
    // service-role client only; the route is the sole legitimate writer.
    // authenticated INSERT/UPDATE grants are revoked (see migration
    // 20260516120100) so a client cannot forge status/cached_response rows.
    const { data: insertedLookup, error: insertError } = await supabaseAdmin
      .from('imei_lookups')
      .insert({
        amount_ngn: amount,
        customer_id: customer.id,
        idempotency_key: idempotencyKey,
        imei_hash: imeiHash,
        device_category: deviceCategory ?? null,
        merchant_id: merchantId,
        status: 'pending',
        tier: requestedTier,
      })
      .select('id')
      .single();

    if (insertError) {
      if (isUniqueViolation(insertError)) {
        const winningLookup = await findLookupByIdempotencyKey(
          supabaseAdmin,
          idempotencyKey
        );
        if (winningLookup) {
          return mapExistingLookup(winningLookup, replayContext);
        }

        return json(
          errorBody({
            code: 'IDEMPOTENCY_CONFLICT',
            error: 'Idempotency-Key already belongs to another request.',
          }),
          409
        );
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
      provider: binding.provider,
    };

    let preflightBalance: number | undefined;
    try {
      preflightBalance = await readCustomerWalletBalance({
        customerId: customer.id,
        merchantId,
        supabase,
      });
    } catch (balanceError) {
      console.error('[IMEI Check] Failed to read preflight wallet balance:', {
        customerId: customer.id,
        error: balanceError,
        merchantId,
      });
    }

    if (binding.provider === 'petrock') {
      try {
        return await submitPetrockLookup({
          amount,
          binding,
          checksIncluded: serviceTier.checksIncluded,
          customerId: customer.id,
          deviceCategory,
          encryptionKey: encryptionKey as string,
          identifier: normalizedImei,
          lookupId: activeLookup.id,
          merchantId,
          onDebitSucceeded: () => {
            debitSucceeded = true;
          },
          origin: request.nextUrl.origin,
          provider,
          supabaseAdmin,
          tierName: serviceTier.name,
        });
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
          supabaseAdmin,
        });
      }
    }

    try {
      await redeemImeiWalletPayment({
        amount,
        customerId: customer.id,
        lookupId: activeLookup.id,
        merchantId,
        supabaseAdmin,
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
        supabaseAdmin,
      });
    }

    const providerStartedAt = Date.now();
    const providerOutcome = await provider.submit({
      binding,
      checksIncluded: serviceTier.checksIncluded,
      feedbackUrl: '',
      identifier: normalizedImei,
      referenceId: activeLookup.id,
      tierName: serviceTier.name,
    });
    const providerLatencyMs = Date.now() - providerStartedAt;

    if (providerOutcome.kind === 'complete') {
      return await cacheSuccessfulLookup({
        amount,
        customerId: customer.id,
        latencyMs: providerLatencyMs,
        lookupId: activeLookup.id,
        merchantId,
        providerResult: {
          body: providerOutcome.body,
          ok: true,
          rawResponseText: providerOutcome.rawResponseText,
          sickwStatus: providerOutcome.providerStatus,
          status: providerOutcome.status,
        },
        supabaseAdmin,
        tier: requestedTier,
      });
    }

    if (providerOutcome.kind !== 'failure') {
      throw new Error('Sickw unexpectedly returned a non-terminal outcome');
    }

    return await refundAndCacheFailure({
      amount,
      body: providerOutcome.body,
      customerId: customer.id,
      lookupId: activeLookup.id,
      merchantId,
      refundSuccessStatus:
        providerOutcome.refundReason === 'not_found'
          ? 'refunded_not_found'
          : 'refunded_error',
      sickwStatus: providerOutcome.providerStatus,
      status: providerOutcome.status,
      supabaseAdmin,
    });
  } catch (error) {
    console.error('IMEI check error:', error);
    if (!debitSucceeded && activeLookup && supabase) {
      const body = errorBody({
        code: 'INTERNAL_ERROR',
        error: 'Internal server error',
      });

      try {
        await cacheLookupResponse({
          body,
          lookupId: activeLookup.id,
          sickwStatus: 'wallet_debit_error',
          status: 500,
          supabaseAdmin: supabaseAdmin ?? createAdminClient(),
          terminalStatus: 'failed_error',
        });
      } catch (cacheError) {
        console.error('[IMEI Check] Failed to cache debit failure:', {
          error: cacheError,
          lookupId: activeLookup.id,
          merchantId: activeLookup.merchantId,
        });
        const { error: deleteError } = await (
          supabaseAdmin ?? createAdminClient()
        )
          .from('imei_lookups')
          .delete()
          .eq('id', activeLookup.id)
          .select('id')
          .single();

        if (deleteError) {
          console.error(
            '[IMEI Check] Failed to remove uncharged pending lookup after debit failure:',
            {
              error: deleteError,
              lookupId: activeLookup.id,
              merchantId: activeLookup.merchantId,
            }
          );
          return json(
            errorBody({
              code: 'DEBIT_FAILURE_STATE_SAVE_FAILED',
              error:
                'Wallet debit failed and lookup state could not be finalized. Contact support before retrying.',
            }),
            500
          );
        }
      }

      return json(body, 500);
    }

    if (
      debitSucceeded &&
      activeLookup?.provider === 'petrock' &&
      supabaseAdmin
    ) {
      try {
        await markPetrockSubmissionUnknown({
          lookupId: activeLookup.id,
          providerStatus: 'route_unexpected_error',
          supabaseAdmin,
        });
      } catch (stateError) {
        console.error(
          '[IMEI Check] Failed to classify unexpected Petrock error',
          { lookupId: activeLookup.id, stateError }
        );
      }
      return pendingPetrockResponse(activeLookup.id);
    }

    if (debitSucceeded && activeLookup && supabase) {
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
        supabaseAdmin: supabaseAdmin ?? createAdminClient(),
      });
    }

    return json(
      errorBody({ code: 'INTERNAL_ERROR', error: 'Internal server error' }),
      500
    );
  }
}
