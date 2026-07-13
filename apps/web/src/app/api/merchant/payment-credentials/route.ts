import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/ai/provider';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
  type UserAccess,
} from '@/lib/api-auth';
import {
  revalidateFeatures,
  revalidateMerchant,
} from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  deleteMerchantCredential,
  deleteMerchantCredentials,
  getMerchantPaymentCredentialMeta,
  setMerchantPaymentCredential,
  touchMerchantCredentialValidated,
} from '@/lib/payments/merchant-credentials';
import { disablePaypalFeatureFlag } from '@/lib/payments/paypal-feature-flag';
import { getAccessToken } from '@/lib/paypal';
import {
  merchantPaymentCredentialsDeleteSchema,
  merchantPaymentCredentialsSaveSchema,
  paymentCredentialProviderSchema,
} from '@/schemas/merchant-payment-credentials';
import {
  jsonNoStore,
  toPayPalMode,
  toStatusResponse,
  withNoStore,
} from './payment-credentials-route-utils';

// Authorization boundary for the BYOK credential vault. The vault RPCs do no
// caller authorization, so every handler must check merchant-staff access before
// touching credentials. Responses are write-only status views only.

const VALIDATION_RATE_LIMIT = { requests: 5, windowMs: 60_000 } as const;

type GuardResult =
  | { ok: true; supabase: SupabaseClient; userId: string; access: UserAccess }
  | { ok: false; response: NextResponse };

async function guard(
  request: NextRequest,
  action: 'view' | 'edit',
  requireCsrf: boolean
): Promise<GuardResult> {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return {
      ok: false,
      response: jsonNoStore(
        { error: auth.error ?? 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  if (requireCsrf) {
    const csrf = await checkCsrfProtection(request);
    if (!csrf.valid) {
      return {
        ok: false,
        response: csrf.response
          ? withNoStore(csrf.response)
          : jsonNoStore({ error: 'CSRF validation failed' }, { status: 403 }),
      };
    }
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return {
      ok: false,
      response: jsonNoStore({ error: 'Merchant not found' }, { status: 404 }),
    };
  }

  if (!hasPermission(access, 'settings', action)) {
    return {
      ok: false,
      response: jsonNoStore({ error: 'Permission denied' }, { status: 403 }),
    };
  }

  return { ok: true, supabase: auth.supabase, userId: auth.user.id, access };
}

export async function GET(request: NextRequest) {
  try {
    const guarded = await guard(request, 'view', false);
    if (!guarded.ok) {
      return guarded.response;
    }

    const providerResult = paymentCredentialProviderSchema.safeParse(
      request.nextUrl.searchParams.get('provider')
    );
    if (!providerResult.success) {
      return jsonNoStore(
        {
          error: providerResult.error.issues[0]?.message ?? 'Invalid provider',
        },
        { status: 400 }
      );
    }

    const rows = await getMerchantPaymentCredentialMeta(
      guarded.access.merchantId,
      providerResult.data
    );

    return jsonNoStore(toStatusResponse(rows));
  } catch (error) {
    console.error('payment-credentials GET error:', error);
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guarded = await guard(request, 'edit', true);
    if (!guarded.ok) {
      return guarded.response;
    }

    const { allowed } = checkRateLimit(
      `payment-credentials:validate:${guarded.userId}`,
      VALIDATION_RATE_LIMIT
    );
    if (!allowed) {
      return jsonNoStore(
        {
          error: 'Too many validation attempts. Try again in a minute.',
          code: 'rate_limited',
        },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = merchantPaymentCredentialsSaveSchema.safeParse(body);
    if (!parsed.success) {
      return jsonNoStore(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { provider, environment, clientId, secretKey } = parsed.data;

    // Validate-on-save: authenticate against the target environment with the
    // submitted (already-trimmed) creds. Never store what we cannot mint a
    // token with.
    const validation = await getAccessToken(
      clientId,
      secretKey,
      toPayPalMode(environment)
    );
    if (!validation.success) {
      return jsonNoStore(
        {
          error:
            'PayPal rejected these credentials. Check the client ID, secret, and environment, then try again.',
          code: 'invalid_provider_credentials',
        },
        { status: 400 }
      );
    }

    const { merchantId } = guarded.access;
    // Persist the pair atomically-in-effect (S-245): write client_id, then
    // secret_key. If the secret_key write fails, the client_id write already
    // landed, so roll the WHOLE pair back — checkout otherwise resolves one role
    // and 401s on the missing/rotated other, silently failing every payment.
    // Fail-closed: no credentials beats a mismatched half-pair. The rollback
    // delete is best-effort so the original write error surfaces as the 500.
    await setMerchantPaymentCredential(
      merchantId,
      provider,
      'client_id',
      environment,
      clientId
    );
    try {
      await setMerchantPaymentCredential(
        merchantId,
        provider,
        'secret_key',
        environment,
        secretKey
      );
    } catch (writeError) {
      // Roll back ONLY the two roles just written at THIS environment
      // (payment-credentials:204). The provider-wide delete would nuke an
      // unrelated LIVE pair when a sandbox save half-failed.
      try {
        await deleteMerchantCredential(
          merchantId,
          provider,
          'client_id',
          environment
        );
        await deleteMerchantCredential(
          merchantId,
          provider,
          'secret_key',
          environment
        );
      } catch (rollbackError) {
        console.error(
          'payment-credentials: failed to roll back half-saved credential pair:',
          rollbackError
        );
      }
      throw writeError;
    }
    // Only the environment we actually validated may be stamped — see
    // touchMerchantCredentialValidated.
    await touchMerchantCredentialValidated(merchantId, provider, environment);

    const rows = await getMerchantPaymentCredentialMeta(merchantId, provider);
    return jsonNoStore(toStatusResponse(rows));
  } catch (error) {
    console.error('payment-credentials POST error:', error);
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guarded = await guard(request, 'edit', true);
    if (!guarded.ok) {
      return guarded.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = merchantPaymentCredentialsDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return jsonNoStore(
        { error: parsed.error.issues[0]?.message ?? 'Invalid provider' },
        { status: 400 }
      );
    }

    const { merchantId } = guarded.access;
    const { provider } = parsed.data;

    await deleteMerchantCredentials(merchantId, provider);
    if (provider === 'paypal') {
      await disablePaypalFeatureFlag(merchantId);
    }

    revalidateFeatures(merchantId);
    revalidateMerchant(merchantId);

    const rows = await getMerchantPaymentCredentialMeta(merchantId, provider);
    return jsonNoStore(toStatusResponse(rows));
  } catch (error) {
    console.error('payment-credentials DELETE error:', error);
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}
