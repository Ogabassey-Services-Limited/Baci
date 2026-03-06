import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  readMobileOnboardingMetadata: vi.fn(),
  provisionMobileOnboarding: vi.fn(),
  after: vi.fn(),
}));

const mockGetUser = mocks.getUser;
const mockReadMobileOnboardingMetadata = mocks.readMobileOnboardingMetadata;
const mockProvisionMobileOnboarding = mocks.provisionMobileOnboarding;
const mockAfter = mocks.after;

const mockSupabaseServer = {
  auth: { getUser: mockGetUser },
};

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

vi.mock('@/lib/mobile-onboarding/metadata', () => ({
  readMobileOnboardingMetadata: mocks.readMobileOnboardingMetadata,
}));

vi.mock('@/lib/mobile-onboarding/provision', () => ({
  provisionMobileOnboarding: mocks.provisionMobileOnboarding,
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com' },
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: mocks.after,
  };
});

import { POST } from './route';

describe('POST /api/mobile-onboarding/finalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when auth lookup fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth service unavailable' },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
  });

  it('returns 409 when auth metadata is incomplete', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });
    mockReadMobileOnboardingMetadata.mockReturnValue({
      success: false,
      error: 'Account setup details are missing. Please complete your profile.',
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('PROFILE_INCOMPLETE');
  });

  it('returns the provisioning failure status and code', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          user_metadata: {},
        },
      },
      error: null,
    });
    mockReadMobileOnboardingMetadata.mockReturnValue({
      success: true,
      data: {
        email: 'test@example.com',
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Test Store',
        businessType: 'fashion',
        otherBusinessType: null,
        phone: null,
        slug: 'test-store',
        logoUrl: null,
        brandColors: null,
      },
    });
    mockProvisionMobileOnboarding.mockResolvedValue({
      success: false,
      status: 422,
      body: {
        error:
          'Store link is already in use. Please complete your profile to choose another one.',
        code: 'SLUG_UNAVAILABLE',
      },
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      error:
        'Store link is already in use. Please complete your profile to choose another one.',
      code: 'SLUG_UNAVAILABLE',
    });
    expect(mockProvisionMobileOnboarding).toHaveBeenCalledTimes(1);
  });

  it('finalizes onboarding from auth metadata for authenticated users', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          user_metadata: {},
        },
      },
      error: null,
    });
    mockReadMobileOnboardingMetadata.mockReturnValue({
      success: true,
      data: {
        email: 'test@example.com',
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Test Store',
        businessType: 'fashion',
        otherBusinessType: null,
        phone: null,
        slug: 'test-store',
        logoUrl: null,
        brandColors: null,
      },
    });
    mockProvisionMobileOnboarding.mockResolvedValue({
      success: true,
      user: { id: 'user-1', email: 'test@example.com' },
      merchant: { id: 'merch-1', slug: 'test-store' },
      message: 'Account created successfully',
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockProvisionMobileOnboarding).toHaveBeenCalledWith({
      supabase: mockSupabaseServer,
      user: { id: 'user-1', email: 'test@example.com' },
      profile: {
        email: 'test@example.com',
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        businessName: 'Test Store',
        businessType: 'fashion',
        otherBusinessType: null,
        phone: null,
        slug: 'test-store',
        logoUrl: null,
        brandColors: null,
      },
      rootDomain: 'usebaci.com',
      defer: mockAfter,
    });
  });

  it('returns 500 when metadata parsing throws unexpectedly', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          user_metadata: {},
        },
      },
      error: null,
    });
    mockReadMobileOnboardingMetadata.mockImplementation(() => {
      throw new Error('unexpected metadata shape');
    });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
  });
});
