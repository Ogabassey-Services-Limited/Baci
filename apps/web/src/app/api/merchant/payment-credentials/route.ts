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
  deleteMerchantCredentials,
  getMerchantPaymentCredentialMeta,
  setMerchantPaymentCredential,
  touchMerchantCredentialValidated,
} from '@/lib/payments/merchant-credentials';
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

// Disable the non-secret PayPal feature flag after disconnect, using the
// caller's RLS-scoped client after guard() has enforced settings.edit.
async function disablePaypalFeatureFlag(
  supabase: SupabaseClient,
  merchantId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('merchant_feature_settings')
    .select('custom_settings')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `payment-credentials: failed to load feature settings: ${error.message}`
    );
  }

  if (!data) {
    return;
  }

  const existing =
    data.custom_settings && typeof data.custom_settings === 'object'
      ? (data.custom_settings as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase
    .from('merchant_feature_settings')
    .update({
      custom_settings: { ...existing, paypal_enabled: false },
      updated_at: new Date().toISOString(),
    })
    .eq('merchant_id', merchantId);

  if (updateError) {
    throw new Error(
      `payment-credentials: failed to disable paypal flag: ${updateError.message}`
    );
  }
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
    await setMerchantPaymentCredential(
      merchantId,
      provider,
      'client_id',
      environment,
      clientId
    );
    await setMerchantPaymentCredential(
      merchantId,
      provider,
      'secret_key',
      environment,
      secretKey
    );
    await touchMerchantCredentialValidated(merchantId, provider);

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
      await disablePaypalFeatureFlag(guarded.supabase, merchantId);
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
