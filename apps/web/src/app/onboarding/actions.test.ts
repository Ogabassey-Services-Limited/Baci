import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock setup ---

const { mockGetConfiguredAppUrl, mockGetRootDomain } = vi.hoisted(() => ({
  mockGetConfiguredAppUrl: vi.fn(),
  mockGetRootDomain: vi.fn(),
}));

const mockGetUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockSupabaseServer = {
  auth: {
    getUser: mockGetUser,
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
  },
};

const mockAdminInsert = vi.fn();
const mockAdminUpdate = vi.fn();
const mockAdminSelect = vi.fn();
const mockAdminMaybeSingle = vi.fn();
const mockAdminSingle = vi.fn();
const mockAdminEq = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminClient = { from: mockAdminFrom };

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

vi.mock('@/env', () => ({
  getConfiguredAppUrl: mockGetConfiguredAppUrl,
  getRootDomain: mockGetRootDomain,
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

vi.mock('@/services/hero-image-generator', () => ({
  assignHeroImagesToMerchant: vi.fn().mockResolvedValue(undefined),
}));

import { submitOnboarding } from './actions';

// --- Helpers ---

function makeFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const validFields = {
  email: 'merchant@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  businessName: 'TestStore',
  businessType: 'fashion',
  logoUrl: 'https://example.com/logo.png',
  brandColors: JSON.stringify({
    primary: '#000000',
    background: '#ffffff',
    accent: '#F59E0B',
  }),
};

const prevState = { success: false, message: '' };

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
    mockGetConfiguredAppUrl.mockReturnValue('https://usebaci.com');
    mockGetRootDomain.mockReturnValue('usebaci.com');

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
          update: vi.fn().mockReturnValue({
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
          insert: vi.fn().mockResolvedValue({ error: null }),
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
        email: 'merchant@example.com',
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
});
