import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');

  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void Promise.resolve()
        .then(callback)
        .catch(() => undefined);
    },
  };
});

// --- Mock setup ---

const {
  mockGetAppUrl,
  mockGetConfiguredAppUrl,
  mockGetOllamaStorefrontModel,
  mockGetRootDomain,
  mockIsAiStorefrontGenerationEnabled,
  mockIsProduction,
  mockTriggerAiStorefrontWorker,
} = vi.hoisted(() => ({
  mockGetAppUrl: vi.fn(),
  mockGetConfiguredAppUrl: vi.fn(),
  mockGetOllamaStorefrontModel: vi.fn(),
  mockGetRootDomain: vi.fn(),
  mockIsAiStorefrontGenerationEnabled: vi.fn(),
  mockIsProduction: vi.fn(),
  mockTriggerAiStorefrontWorker: vi.fn(),
}));

const mockGetUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithOtp = vi.fn();
const { mockEnsureActionRateLimit } = vi.hoisted(() => ({
  mockEnsureActionRateLimit: vi.fn(),
}));
const mockSupabaseServer = {
  auth: {
    getUser: mockGetUser,
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    signInWithOtp: mockSignInWithOtp,
  },
};

const mockAdminInsert = vi.fn();
const mockAdminUpdate = vi.fn();
const mockAdminSelect = vi.fn();
const mockAdminMaybeSingle = vi.fn();
const mockAdminSingle = vi.fn();
const mockAdminEq = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();
const mockPageConfigInsert = vi.fn();
const mockPageConfigSelect = vi.fn();
const mockPageConfigSingle = vi.fn();
const mockAiJobsInsert = vi.fn();
const mockAdminClient = { from: mockAdminFrom, rpc: mockAdminRpc };

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    get: () => null,
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseServer),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mockEnsureActionRateLimit,
}));

vi.mock('@/env', () => ({
  getAppUrl: mockGetAppUrl,
  getConfiguredAppUrl: mockGetConfiguredAppUrl,
  getOllamaStorefrontModel: mockGetOllamaStorefrontModel,
  getRootDomain: mockGetRootDomain,
  isAiStorefrontGenerationEnabled: mockIsAiStorefrontGenerationEnabled,
  isProduction: mockIsProduction,
}));

vi.mock('@/lib/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/initial-template-generator', () => ({
  generateInitialTemplate: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/ai-storefront/trigger-storefront-worker', () => ({
  triggerAiStorefrontWorker: mockTriggerAiStorefrontWorker,
}));

vi.mock('@/services/hero-image-generator', () => ({
  assignHeroImagesToMerchant: vi.fn().mockResolvedValue(undefined),
}));

import { sendMagicLink, submitOnboarding } from './actions';

// --- Helpers ---

function makeFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

async function flushAfterCallbacks() {
  // The mocked after() callback runs in a microtask that schedules the async
  // trigger body in another microtask, so both ticks are intentional.
  await Promise.resolve();
  await Promise.resolve();
}

const validFields = {
  email: 'merchant@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  businessName: 'TestStore',
  businessType: 'fashion',
  country: 'NG',
  logoUrl: 'https://example.com/logo.png',
  brandColors: JSON.stringify({
    primary: '#000000',
    background: '#ffffff',
    accent: '#F59E0B',
  }),
};

const prevState = { success: false, message: '' };
const MOCK_PAGE_CONFIG_UPDATED_AT = '2026-04-28T10:00:00.000Z';

function setupChainedMock(
  finalData: unknown,
  finalError: unknown = null
): void {
  mockAdminSingle.mockResolvedValue({
    data: finalData,
    error: finalError,
  });
  mockAdminSelect.mockReturnValue({ single: mockAdminSingle });
  mockAdminInsert.mockReturnValue({ select: mockAdminSelect });
  mockAdminUpdate.mockReturnValue({ select: mockAdminSelect });
  mockAdminEq.mockReturnValue({ select: mockAdminSelect });
}

describe('submitOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureActionRateLimit.mockResolvedValue(true);
    mockGetAppUrl.mockReturnValue('http://localhost:3000');
    mockGetConfiguredAppUrl.mockReturnValue('https://usebaci.com');
    mockGetOllamaStorefrontModel.mockReturnValue('gemma4:e4b');
    mockGetRootDomain.mockReturnValue('usebaci.com');
    mockIsAiStorefrontGenerationEnabled.mockReturnValue(false);
    mockIsProduction.mockReturnValue(false);
    mockTriggerAiStorefrontWorker.mockResolvedValue({
      triggered: true,
      status: 202,
    });
    mockAdminRpc.mockResolvedValue({ data: null, error: null });
    mockPageConfigSingle.mockResolvedValue({
      data: { updated_at: MOCK_PAGE_CONFIG_UPDATED_AT },
      error: null,
    });
    mockPageConfigSelect.mockReturnValue({ single: mockPageConfigSingle });
    mockPageConfigInsert.mockReturnValue({ select: mockPageConfigSelect });
    mockAiJobsInsert.mockResolvedValue({ data: null, error: null });

    // Default: no existing auth session
    mockGetUser.mockResolvedValue({ data: { user: null } });

    // Default: sign-in fails (new user), sign-up succeeds
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'merchant@example.com' },
        session: { access_token: 'test-token' },
      },
      error: null,
    });

    // Admin client chain
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: mockAdminMaybeSingle,
            }),
          }),
          insert: mockAdminInsert,
          update: mockAdminUpdate.mockReturnValue({
            eq: mockAdminEq,
          }),
        };
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'page_configs') {
        return {
          insert: mockPageConfigInsert,
        };
      }
      if (table === 'ai_jobs') {
        return {
          insert: mockAiJobsInsert,
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });
  });

  it('returns a rate-limit error before touching auth or the database', async () => {
    mockEnsureActionRateLimit.mockResolvedValueOnce(false);

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Too many onboarding attempts');
    expect(mockEnsureActionRateLimit).toHaveBeenCalledWith(
      'onboarding-submit',
      { requests: 5, windowMs: 900_000 }
    );
    expect(mockAdminFrom).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid form data', async () => {
    const formData = makeFormData({ email: 'bad' });
    const result = await submitOnboarding(prevState, formData);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Form is incomplete');
  });

  it('sets signup_source to web when creating a new merchant', async () => {
    // No existing merchant
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // pre-check by email
      .mockResolvedValueOnce({ data: null, error: null }); // lookup by user_id

    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        signup_source: 'web',
        business_name: 'TestStore',
        country: 'NG',
        email: 'merchant@example.com',
        payout_currency: 'NGN',
      })
    );
  });

  it('falls back to buildMerchantSlug when the RPC returns no usable data', async () => {
    // mockAdminRpc default in beforeEach is `{ data: null, error: null }`.
    // This exercises the local fallback path in `resolveMerchantSlug`, not
    // the RPC slug. The previous test name ("derives merchant slug from the
    // full business name") implied the primary path — renamed for clarity.
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'baci-food-123' });

    const result = await submitOnboarding(
      prevState,
      makeFormData({
        ...validFields,
        businessName: 'Baci Food 123',
      })
    );

    expect(result.success).toBe(true);
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Baci Food 123',
        slug: 'baci-food-123',
      })
    );
  });

  it('falls back to buildMerchantSlug when the slug RPC returns an error', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mockAdminRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC failed', code: 'XX000' },
    });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'TestStore',
        slug: 'teststore',
      })
    );
  });

  it('falls back when the slug RPC returns a non-string payload', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mockAdminRpc.mockResolvedValueOnce({ data: 12345, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'teststore' })
    );
  });

  it('falls back when the slug RPC returns an empty / whitespace string', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mockAdminRpc.mockResolvedValueOnce({ data: '   ', error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'teststore' })
    );
  });

  it('uses the database slug generator to avoid merchant slug collisions', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mockAdminRpc.mockResolvedValueOnce({ data: 'teststore-2', error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore-2' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAdminRpc).toHaveBeenCalledWith('generate_slug', {
      text_input: 'TestStore',
    });
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'TestStore',
        slug: 'teststore-2',
      })
    );
  });

  it('uses local app URL for password signup redirects outside production', async () => {
    mockGetConfiguredAppUrl.mockReturnValue(null);
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          emailRedirectTo: 'http://localhost:3000/onboarding',
        },
      })
    );
  });

  it('does not set signup_source when updating an incomplete merchant', async () => {
    // Pre-check returns no completed merchant
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // pre-check by email
      .mockResolvedValueOnce({
        data: { id: 'existing-1', business_name: null },
        error: null,
      }); // lookup by user_id — incomplete record

    setupChainedMock({ id: 'existing-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    // Update path should NOT have been called with signup_source
    expect(mockAdminInsert).not.toHaveBeenCalled();
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'NG',
        payout_currency: 'NGN',
      })
    );
  });

  it('does not rewrite an established slug when completing a pending merchant', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'existing-1',
          business_name: null,
          slug: '  merchant-chosen-slug  ',
        },
        error: null,
      });
    setupChainedMock({ id: 'existing-1', slug: '  merchant-chosen-slug  ' });

    const result = await submitOnboarding(
      prevState,
      makeFormData({
        ...validFields,
        businessName: 'Renamed Business',
      })
    );

    expect(result.success).toBe(true);
    expect(mockAdminRpc).not.toHaveBeenCalledWith('generate_slug', {
      text_input: 'Renamed Business',
    });
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Renamed Business',
      })
    );
    expect(mockAdminUpdate.mock.calls[0]?.[0]).not.toHaveProperty('slug');
    expect(mockAdminUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'renamed-business' })
    );
  });

  it('generates a unique slug when completing a pending merchant without an established slug', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'existing-1',
          business_name: null,
          slug: null,
        },
        error: null,
      });
    mockAdminRpc.mockResolvedValueOnce({
      data: 'teststore-2',
      error: null,
    });
    setupChainedMock({ id: 'existing-1', slug: 'teststore-2' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAdminRpc).toHaveBeenCalledWith('generate_slug', {
      text_input: 'TestStore',
    });
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'teststore-2' })
    );
  });

  it('returns early for existing completed merchant', async () => {
    mockAdminMaybeSingle.mockResolvedValueOnce({
      data: { id: 'existing-1', business_name: 'Already Set Up' },
      error: null,
    });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });

  it('does not enqueue an AI job or report success when starter page insert fails', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
    mockPageConfigSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'insert failed' },
    });
    mockIsAiStorefrontGenerationEnabled.mockReturnValue(true);

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to create starter page config');
    expect(mockAiJobsInsert).not.toHaveBeenCalled();
  });

  it('enqueues a storefront generation job when the rollout flag is enabled', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
    mockIsAiStorefrontGenerationEnabled.mockReturnValue(true);

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAiJobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        type: 'storefront_layout_generation',
        status: 'pending',
        idempotency_key: 'storefront-layout:merchant-1:home:onboarding',
        input: expect.objectContaining({
          pageSlug: 'home',
          businessName: 'TestStore',
          businessType: 'fashion',
          createdPageConfigUpdatedAt: MOCK_PAGE_CONFIG_UPDATED_AT,
        }),
        model: 'gemma4:e4b',
      })
    );
  });

  it('triggers the VPS storefront worker after onboarding enqueues a storefront job', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
    mockIsAiStorefrontGenerationEnabled.mockReturnValue(true);

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    await flushAfterCallbacks();
    expect(mockTriggerAiStorefrontWorker).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      source: 'onboarding',
    });
  });

  it('triggers the VPS storefront worker when the onboarding AI job already exists', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
    mockIsAiStorefrontGenerationEnabled.mockReturnValue(true);
    mockAiJobsInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'duplicate key', code: '23505' },
    });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    await flushAfterCallbacks();
    expect(mockTriggerAiStorefrontWorker).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      source: 'onboarding',
    });
  });

  it('keeps onboarding successful when the storefront worker trigger fails', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
    mockIsAiStorefrontGenerationEnabled.mockReturnValue(true);
    mockTriggerAiStorefrontWorker.mockRejectedValueOnce(
      new Error('trigger unavailable')
    );

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    await flushAfterCallbacks();
    expect(mockTriggerAiStorefrontWorker).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      source: 'onboarding',
    });
  });

  it('keeps onboarding successful when AI job enqueue fails', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });
    mockIsAiStorefrontGenerationEnabled.mockReturnValue(true);
    mockAiJobsInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'queue unavailable', code: 'XX000' },
    });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAiJobsInsert).toHaveBeenCalled();
  });

  it('does not enqueue a storefront generation job when the rollout flag is disabled', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAiJobsInsert).not.toHaveBeenCalled();
  });

  it('persists the parsed brand_colors palette when the payload is valid JSON', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAdminInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_colors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      })
    );
  });

  it('omits brand_colors entirely (no null write) when the palette JSON is malformed on a new merchant', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    setupChainedMock({ id: 'merchant-1', slug: 'teststore' });

    const result = await submitOnboarding(
      prevState,
      makeFormData({ ...validFields, brandColors: '{not-valid-json' })
    );

    expect(result.success).toBe(true);
    const insertPayload = mockAdminInsert.mock.calls[0]?.[0];
    expect(insertPayload).not.toHaveProperty('brand_colors');
    expect(mockAdminInsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ brand_colors: null })
    );
  });

  it('omits brand_colors when malformed while completing an incomplete merchant, leaving the established palette untouched', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // pre-check by email
      .mockResolvedValueOnce({
        data: { id: 'existing-1', business_name: null, slug: 'teststore' },
        error: null,
      }); // lookup by user_id — incomplete record
    setupChainedMock({ id: 'existing-1', slug: 'teststore' });

    const result = await submitOnboarding(
      prevState,
      makeFormData({ ...validFields, brandColors: 'NOT JSON' })
    );

    expect(result.success).toBe(true);
    expect(mockAdminInsert).not.toHaveBeenCalled();
    const updatePayload = mockAdminUpdate.mock.calls[0]?.[0];
    expect(updatePayload).not.toHaveProperty('brand_colors');
    expect(mockAdminUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ brand_colors: null })
    );
  });

  it('still writes brand_colors when valid while completing an incomplete merchant', async () => {
    mockAdminMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: 'existing-1', business_name: null, slug: 'teststore' },
        error: null,
      });
    setupChainedMock({ id: 'existing-1', slug: 'teststore' });

    const result = await submitOnboarding(prevState, makeFormData(validFields));

    expect(result.success).toBe(true);
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_colors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      })
    );
  });
});

describe('sendMagicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureActionRateLimit.mockResolvedValue(true);
    mockGetAppUrl.mockReturnValue('http://localhost:3000');
    mockGetConfiguredAppUrl.mockReturnValue('https://usebaci.com');
    mockIsProduction.mockReturnValue(false);
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it('returns a rate-limit error without sending an OTP email', async () => {
    mockEnsureActionRateLimit.mockResolvedValueOnce(false);

    const result = await sendMagicLink('merchant@example.com');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Too many magic link requests');
    expect(mockEnsureActionRateLimit).toHaveBeenCalledWith('magic-link', {
      requests: 3,
      windowMs: 60_000,
    });
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('returns an error for an empty email without sending an OTP email', async () => {
    const result = await sendMagicLink('');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Email is required.');
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('rejects an invalid email without sending an OTP email', async () => {
    const result = await sendMagicLink('not-an-email');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Please enter a valid email address.');
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('rejects an overlong email without sending an OTP email', async () => {
    const result = await sendMagicLink(`${'a'.repeat(250)}@example.com`);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Email address is too long.');
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it('sends the magic link with the onboarding redirect on success', async () => {
    const result = await sendMagicLink('merchant@example.com');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Magic link sent');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'merchant@example.com',
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://usebaci.com/onboarding?fromMagicLink=true',
      },
    });
  });

  it('surfaces supabase OTP errors as a failed result', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({
      error: new Error('OTP rate limit reached'),
    });

    const result = await sendMagicLink('merchant@example.com');

    expect(result.success).toBe(false);
    expect(result.message).toBe('OTP rate limit reached');
  });
});
