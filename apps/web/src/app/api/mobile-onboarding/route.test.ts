import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signUp: vi.fn(),
  createScopedClient: vi.fn(),
  provisionMobileOnboarding: vi.fn(),
  after: vi.fn(),
}));

const mockGetUser = mocks.getUser;
const mockSignUp = mocks.signUp;
const mockCreateScopedClient = mocks.createScopedClient;
const mockProvisionMobileOnboarding = mocks.provisionMobileOnboarding;
const mockAfter = mocks.after;

const mockSupabaseServer = {
  auth: { getUser: mockGetUser, signUp: mockSignUp },
};
const mockScopedSupabase = { from: vi.fn() };

vi.mock('@/lib/password-breach', () => ({
  checkPasswordBreach: vi
    .fn()
    .mockResolvedValue({ isBreached: false, count: 0 }),
}));

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

vi.mock('@/lib/supabase/scoped', () => ({
  createScopedClient: mocks.createScopedClient,
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

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/mobile-onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const validBody = {
  email: 'test@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  firstName: 'John',
  lastName: 'Doe',
  businessName: 'Test Store',
  businessType: 'fashion',
  slug: 'test-store',
  logoUrl: 'https://cdn.usebaci.com/logo.png',
  brandColors: JSON.stringify({
    primary: '#000000',
    background: '#ffffff',
    accent: '#F59E0B',
  }),
};

describe('POST /api/mobile-onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateScopedClient.mockReturnValue(mockScopedSupabase);
    mockProvisionMobileOnboarding.mockResolvedValue({
      success: true,
      user: { id: 'user-1', email: 'test@example.com' },
      merchant: { id: 'merch-1', slug: 'test-store' },
      message: 'Account created successfully',
    });
  });

  it('returns 400 for invalid input', async () => {
    const response = await POST(makeRequest({ email: 'bad' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Validation failed');
  });

  it('returns 403 when email confirmation is required', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: null,
      },
      error: null,
    });

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('EMAIL_CONFIRMATION_REQUIRED');
    expect(mockProvisionMobileOnboarding).not.toHaveBeenCalled();
  });

  it('stores rich onboarding metadata during signup', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: null,
      },
      error: null,
    });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(403);
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'StrongP@ss123!',
      options: {
        data: {
          full_name: 'John Doe',
          first_name: 'John',
          last_name: 'Doe',
          business_name: 'Test Store',
          business_type: 'fashion',
          other_business_type: null,
          phone: null,
          slug: 'test-store',
          logo_url: 'https://cdn.usebaci.com/logo.png',
          brand_colors: {
            primary: '#000000',
            background: '#ffffff',
            accent: '#F59E0B',
          },
        },
      },
    });
  });

  it('provisions onboarding with a scoped client when signup returns a session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCreateScopedClient).toHaveBeenCalledWith('tok-123');
    expect(mockProvisionMobileOnboarding).toHaveBeenCalledWith({
      supabase: mockScopedSupabase,
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
        logoUrl: 'https://cdn.usebaci.com/logo.png',
        brandColors: {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        },
      },
      rootDomain: 'usebaci.com',
      defer: mockAfter,
      overwriteExistingProfile: true,
    });
  });

  it('passes through provisioning errors', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
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

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe('SLUG_UNAVAILABLE');
  });
});
