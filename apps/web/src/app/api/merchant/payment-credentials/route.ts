import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
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
  type MerchantPaymentCredentialMetaRow,
  type PaymentCredentialEnvironment,
  setMerchantPaymentCredential,
  touchMerchantCredentialValidated,
} from '@/lib/payments/merchant-credentials';
import { getAccessToken, type PayPalMode } from '@/lib/paypal';
import {
  merchantPaymentCredentialsDeleteSchema,
  merchantPaymentCredentialsSaveSchema,
  paymentCredentialProviderSchema,
} from '@/schemas/merchant-payment-credentials';

/**
 * Merchant Payment Credentials API — the authorization boundary for the BYOK
 * credential vault. The vault RPCs (see lib/payments/merchant-credentials.ts)
 * do NO caller authorization, so EVERY handler here must check merchant-staff
 * access before touching the vault. Secrets/ciphertext NEVER leave this route:
 * responses are write-only status views (configured / last4 / validation
 * metadata only).
 *
 * GET    ?provider=paypal  — status view (settings:view)
 * POST   { provider, environment, clientId, secretKey } — validate-on-save
 *                           (settings:edit, CSRF)
 * DELETE { provider }      — disconnect + disable the feature flag
 *                           (settings:edit, CSRF)
 */

const VALIDATION_RATE_LIMIT = { requests: 5, windowMs: 60_000 } as const;

const PRIVATE_NO_STORE =
  'private, no-store, no-cache, max-age=0, must-revalidate';

interface PaymentCredentialRoleView {
  role: MerchantPaymentCredentialMetaRow['credential_role'];
  environment: MerchantPaymentCredentialMetaRow['environment'];
  last4: string | null;
  isActive: boolean;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
}

interface PaymentCredentialStatusResponse {
  configured: boolean;
  roles: PaymentCredentialRoleView[];
}

function jsonNoStore<T>(body: T, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', PRIVATE_NO_STORE);
  return NextResponse.json(body, { ...init, headers });
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', PRIVATE_NO_STORE);
  return response;
}

/**
 * Maps vault metadata rows to the write-only status view. NEVER includes a
 * secret or ciphertext — only the last four characters and validation state.
 */
function toStatusResponse(
  rows: MerchantPaymentCredentialMetaRow[]
): PaymentCredentialStatusResponse {
  const roles: PaymentCredentialRoleView[] = rows.map((row) => ({
    role: row.credential_role,
    environment: row.environment,
    last4: row.key_last4,
    isActive: row.is_active,
    lastValidatedAt: row.last_validated_at,
    lastValidationError: row.last_validation_error,
  }));

  // A lane counts as configured once an active secret_key is stored.
  const configured = roles.some(
    (role) => role.role === 'secret_key' && role.isActive
  );

  return { configured, roles };
}

function toPayPalMode(environment: PaymentCredentialEnvironment): PayPalMode {
  return environment === 'live' ? 'live' : 'sandbox';
}

type GuardResult =
  | { ok: true; supabase: SupabaseClient; userId: string; access: UserAccess }
  | { ok: false; response: NextResponse };

/**
 * Auth first, then CSRF (state-changing methods), then merchant access, then
 * the required `settings` permission. Returns the scoped (RLS-enforced) client
 * for the authenticated caller.
 */
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

/**
 * Turns off `custom_settings.paypal_enabled` after a disconnect using the
 * caller's RLS-scoped client (not the admin client): authorization is already
 * enforced by `guard`, and merchant sessions can update their own
 * merchant_feature_settings row (same path as /api/merchant/features PATCH).
 * The full features PATCH handler is not extractable, so we merge the single
 * flag here rather than duplicate its plan/redaction logic. Absent row → the
 * flag was never set, nothing to disable.
 */
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
