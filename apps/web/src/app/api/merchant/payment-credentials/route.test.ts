import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '@/ai/provider';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
  type UserAccess,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  deleteMerchantCredentials,
  getMerchantPaymentCredentialMeta,
  type MerchantPaymentCredentialMetaRow,
  setMerchantPaymentCredential,
  touchMerchantCredentialValidated,
} from '@/lib/payments/merchant-credentials';
import { getAccessToken } from '@/lib/paypal';
import { DELETE, GET, POST } from './route';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/ai/provider', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateFeatures: vi.fn(),
  revalidateMerchant: vi.fn(),
}));

vi.mock('@/lib/payments/merchant-credentials', () => ({
  deleteMerchantCredentials: vi.fn(),
  getMerchantPaymentCredentialMeta: vi.fn(),
  setMerchantPaymentCredential: vi.fn(),
  touchMerchantCredentialValidated: vi.fn(),
}));

vi.mock('@/lib/paypal', () => ({
  getAccessToken: vi.fn(),
}));

const MERCHANT_ID = 'merchant-1';
const USER_ID = 'user-1';
const CLIENT_ID = 'paypal-client-id-1234';
const SECRET_KEY = 'paypal-secret-key-9999';

const access: UserAccess = {
  merchantId: MERCHANT_ID,
  role: 'owner',
  isOwner: true,
  isStaff: false,
  permissions: {},
};

function credentialRow(
  credentialRole: 'client_id' | 'secret_key'
): MerchantPaymentCredentialMetaRow {
  return {
    credential_role: credentialRole,
    disabled_at: null,
    environment: 'live',
    is_active: true,
    key_last4: credentialRole === 'client_id' ? '1234' : '9999',
    last_validated_at: '2026-07-08T12:00:00Z',
    last_validation_error: null,
  };
}

function createRequest(method: 'GET' | 'POST' | 'DELETE', body?: unknown) {
  const url =
    method === 'GET'
      ? 'https://example.com/api/merchant/payment-credentials?provider=paypal'
      : 'https://example.com/api/merchant/payment-credentials';

  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

function saveRequest(
  overrides: Partial<{
    provider: 'paypal';
    environment: 'live';
    clientId: string;
    secretKey: string;
  }> = {}
) {
  return createRequest('POST', {
    provider: 'paypal',
    environment: 'live',
    clientId: CLIENT_ID,
    secretKey: SECRET_KEY,
    ...overrides,
  });
}

function makeFeatureSettingsSupabase() {
  let mode: 'read' | 'update' = 'read';
  let updatePayload: Record<string, unknown> | null = null;
  const query = {
    select: vi.fn(() => {
      mode = 'read';
      return query;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      mode = 'update';
      updatePayload = payload;
      return query;
    }),
    eq: vi.fn(() =>
      mode === 'update' ? Promise.resolve({ error: null }) : query
    ),
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data: {
          custom_settings: { paypal_enabled: true, paypal_mode: 'live' },
        },
        error: null,
      })
    ),
  };

  return {
    from: vi.fn(() => query),
    getUpdatePayload: () => updatePayload,
  };
}

async function responseJson(
  response: Response
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('/api/merchant/payment-credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: USER_ID },
      error: null,
      supabase: makeFeatureSettingsSupabase(),
    } as never);
    vi.mocked(getUserAccess).mockResolvedValue(access);
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 4,
      resetIn: 60_000,
    });
    vi.mocked(getAccessToken).mockResolvedValue({
      success: true,
      data: 'paypal-access-token',
    });
    vi.mocked(setMerchantPaymentCredential).mockResolvedValue('credential-id');
    vi.mocked(touchMerchantCredentialValidated).mockResolvedValue(undefined);
    vi.mocked(deleteMerchantCredentials).mockResolvedValue(undefined);
    vi.mocked(getMerchantPaymentCredentialMeta).mockResolvedValue([
      credentialRow('client_id'),
      credentialRow('secret_key'),
    ]);
  });

  it('returns 401 before CSRF, rate limiting, or vault access when unauthenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    } as never);

    const response = await POST(saveRequest());

    expect(response.status).toBe(401);
    expect(checkCsrfProtection).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(setMerchantPaymentCredential).not.toHaveBeenCalled();
  });

  it('returns 403 for callers without settings.edit and never validates provider credentials', async () => {
    vi.mocked(hasPermission).mockReturnValue(false);

    const response = await POST(saveRequest());

    expect(response.status).toBe(403);
    expect(hasPermission).toHaveBeenCalledWith(access, 'settings', 'edit');
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(setMerchantPaymentCredential).not.toHaveBeenCalled();
  });

  it('returns the CSRF rejection before rate limiting or vault writes', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
    });

    const response = await POST(saveRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'CSRF validation failed',
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(setMerchantPaymentCredential).not.toHaveBeenCalled();
  });

  it('returns 429 when validate-on-save is rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetIn: 50_000,
    });

    const response = await POST(saveRequest());

    expect(response.status).toBe(429);
    expect((await responseJson(response)).code).toBe('rate_limited');
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(setMerchantPaymentCredential).not.toHaveBeenCalled();
  });

  it('rejects invalid PayPal credentials without storing submitted secrets', async () => {
    vi.mocked(getAccessToken).mockResolvedValue({
      success: false,
      error: 'invalid_client',
      code: 'HTTP_401',
    });

    const response = await POST(saveRequest());
    const body = await responseJson(response);

    expect(response.status).toBe(400);
    expect(body.code).toBe('invalid_provider_credentials');
    expect(JSON.stringify(body)).not.toContain(SECRET_KEY);
    expect(setMerchantPaymentCredential).not.toHaveBeenCalled();
  });

  it('validates, stores both PayPal credentials, and returns only redacted status', async () => {
    const response = await POST(
      saveRequest({
        clientId: ` ${CLIENT_ID} `,
        secretKey: ` ${SECRET_KEY} `,
      })
    );
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(getAccessToken).toHaveBeenCalledWith(CLIENT_ID, SECRET_KEY, 'live');
    expect(setMerchantPaymentCredential).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal',
      'client_id',
      'live',
      CLIENT_ID
    );
    expect(setMerchantPaymentCredential).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal',
      'secret_key',
      'live',
      SECRET_KEY
    );
    expect(touchMerchantCredentialValidated).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal'
    );
    expect(body.configured).toBe(true);
    expect(JSON.stringify(body)).not.toContain(CLIENT_ID);
    expect(JSON.stringify(body)).not.toContain(SECRET_KEY);
  });

  it('returns a write-only GET status for callers with settings.view', async () => {
    const response = await GET(createRequest('GET'));
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(hasPermission).toHaveBeenCalledWith(access, 'settings', 'view');
    expect(getMerchantPaymentCredentialMeta).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal'
    );
    expect(body).toEqual({
      configured: true,
      roles: expect.arrayContaining([
        expect.objectContaining({ role: 'client_id', last4: '1234' }),
        expect.objectContaining({ role: 'secret_key', last4: '9999' }),
      ]),
    });
    expect(JSON.stringify(body)).not.toContain(CLIENT_ID);
    expect(JSON.stringify(body)).not.toContain(SECRET_KEY);
  });

  it('disconnects PayPal, disables the feature flag, and returns empty status', async () => {
    const supabase = makeFeatureSettingsSupabase();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: USER_ID },
      error: null,
      supabase,
    } as never);
    vi.mocked(getMerchantPaymentCredentialMeta).mockResolvedValue([]);

    const response = await DELETE(
      createRequest('DELETE', { provider: 'paypal' })
    );
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(deleteMerchantCredentials).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal'
    );
    expect(supabase.getUpdatePayload()).toMatchObject({
      custom_settings: { paypal_enabled: false, paypal_mode: 'live' },
    });
    expect(body).toEqual({ configured: false, roles: [] });
  });
});
