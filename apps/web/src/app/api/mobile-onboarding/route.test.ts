import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock setup ---

const mockGetUser = vi.fn();
const mockSignUp = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockSupabaseServer = {
  auth: { getUser: mockGetUser, signUp: mockSignUp },
  from: mockFrom,
  rpc: mockRpc,
};

const mockAdminFrom = vi.fn();
const mockAdminClient = { from: mockAdminFrom };

// Track after() callbacks for manual execution in tests
const afterCallbacks: Array<() => Promise<void>> = [];

vi.mock('@/lib/password-breach', () => {
  return {
    checkPasswordBreach: vi
      .fn()
      .mockResolvedValue({ isBreached: false, count: 0 }),
  };
});
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

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseServer),
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com' },
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: vi.fn((cb: () => Promise<void>) => {
      afterCallbacks.push(cb);
    }),
  };
});

// Now import the route handler (after mocks are registered)
import { POST } from './route';

// --- Helpers ---

function makeRequest(
  body: Record<string, unknown>,
  headers: HeadersInit = {}
): NextRequest {
  return new NextRequest('http://localhost/api/mobile-onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
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
  brandColors: JSON.stringify({
    primary: '#000',
    background: '#fff',
    accent: '#F59E0B',
  }),
};

// --- Tests ---

describe('POST /api/mobile-onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mockRpc.mockResolvedValue({
      data: 'generated-mobile-slug',
      error: null,
    });
  });

  // --- Validation ---

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeRequest({ email: 'bad' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Validation failed');
  });

  it('returns 400 for invalid email', async () => {
    const res = await POST(
      makeRequest({ ...validBody, email: 'not-an-email' })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Validation failed');
  });

  // --- Auth / Signup ---

  it('returns 400 when password is missing for unauthenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { password, confirmPassword, ...noPasswordBody } = validBody;
    const res = await POST(makeRequest(noPasswordBody));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Password is required for new accounts.');
  });

  it('returns 409 when user already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', status: 422 },
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('User already exists. Please log in.');
  });

  it('returns 429 when signup hits rate limit', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message:
          'For security purposes, you can only request this after 57 seconds.',
        status: 429,
      },
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe(
      'Too many attempts. Please wait a minute and try again.'
    );
  });

  it('returns 429 when signup error has status 429 without message match', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        message: 'Rate limit exceeded',
        status: 429,
      },
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe(
      'Too many attempts. Please wait a minute and try again.'
    );
  });

  it('returns 403 when email confirmation is required (no session token)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: null, // No session = email confirmation required
      },
      error: null,
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('EMAIL_CONFIRMATION_REQUIRED');
  });

  it('returns 400 when password has been breached', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { checkPasswordBreach } = await import('@/lib/password-breach');
    vi.mocked(checkPasswordBreach).mockResolvedValueOnce({
      isBreached: true,
      count: 5,
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain(
      'This password has appeared in 5 known data breaches'
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('proceeds with signup when breach check throws (fail-open)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { checkPasswordBreach } = await import('@/lib/password-breach');
    vi.mocked(checkPasswordBreach).mockRejectedValueOnce(
      new Error('HIBP API timeout')
    );

    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'merch-1', slug: 'test' },
            error: null,
          }),
        };
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    // Signup should succeed despite breach check failure
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSignUp).toHaveBeenCalled();
  });

  // --- Merchant creation ---

  it('returns 500 when merchant lookup fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB error', code: '42P01' },
          }),
        };
      }
      return { insert: vi.fn().mockReturnThis() };
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to check existing account.');
  });

  it('sets signup_source when completing an incomplete merchant on iOS', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    const merchantQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
      update: vi.fn(),
    };
    merchantQuery.select.mockReturnValue(merchantQuery);
    merchantQuery.eq.mockReturnValue(merchantQuery);
    merchantQuery.update.mockReturnValue(merchantQuery);
    merchantQuery.maybeSingle.mockResolvedValue({
      data: {
        id: 'merch-1',
        business_name: null,
        slug: 'mobile-existing-slug',
      },
      error: null,
    });
    merchantQuery.single.mockResolvedValue({
      data: { id: 'merch-1', slug: 'test' },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return merchantQuery;
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(
      makeRequest(validBody, {
        'User-Agent':
          'BaciMobile/1.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(merchantQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        signup_source: 'ios',
      })
    );
    expect(merchantQuery.update.mock.calls[0]?.[0]).not.toHaveProperty('slug');
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('does not overwrite signup_source for an already completed merchant', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    const merchantQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
      update: vi.fn(),
    };
    merchantQuery.select.mockReturnValue(merchantQuery);
    merchantQuery.eq.mockReturnValue(merchantQuery);
    merchantQuery.update.mockReturnValue(merchantQuery);
    merchantQuery.maybeSingle.mockResolvedValue({
      data: {
        id: 'merch-1',
        business_name: 'Existing Store',
        slug: 'stable-mobile-slug',
      },
      error: null,
    });
    merchantQuery.single.mockResolvedValue({
      data: { id: 'merch-1', slug: 'test' },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return merchantQuery;
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(
      makeRequest(
        {
          ...validBody,
          businessName: 'Renamed Store',
          slug: 'requested-new-slug',
        },
        {
          'User-Agent': 'BaciMobile/1.0 (Linux; Android 15)',
        }
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(merchantQuery.update).toHaveBeenCalledTimes(1);
    expect(merchantQuery.update.mock.calls[0]?.[0]).not.toHaveProperty(
      'signup_source'
    );
    expect(merchantQuery.update.mock.calls[0]?.[0]).toMatchObject({
      business_name: 'Renamed Store',
    });
    expect(merchantQuery.update.mock.calls[0]?.[0]).not.toHaveProperty('slug');
  });

  it('generates a unique slug when updating a merchant without an established slug', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    const merchantQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
      update: vi.fn(),
    };
    merchantQuery.select.mockReturnValue(merchantQuery);
    merchantQuery.eq.mockReturnValue(merchantQuery);
    merchantQuery.update.mockReturnValue(merchantQuery);
    merchantQuery.maybeSingle.mockResolvedValue({
      data: {
        id: 'merch-1',
        business_name: null,
        slug: null,
      },
      error: null,
    });
    merchantQuery.single.mockResolvedValue({
      data: { id: 'merch-1', slug: 'generated-mobile-slug' },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return merchantQuery;
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('generate_slug', {
      text_input: 'test',
    });
    expect(merchantQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'generated-mobile-slug',
      })
    );
  });

  // --- Domain creation ---

  it('returns 500 for non-duplicate domain error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'merch-1', slug: 'test' },
            error: null,
          }),
        };
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'RLS violation', code: '42501' },
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe(
      'Failed to provision store domain. Please try again.'
    );
  });

  it('ignores duplicate domain error (code 23505)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'merch-1', slug: 'test' },
            error: null,
          }),
        };
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'duplicate key value', code: '23505' },
          }),
        };
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    // Should succeed despite duplicate domain
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  // --- Success path ---

  it('returns success for valid new registration', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'merch-1', slug: 'test' },
            error: null,
          }),
        };
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user).toEqual({ id: 'user-1', email: 'test@example.com' });
    expect(body.merchant).toEqual({ id: 'merch-1', slug: 'test' });
    expect(body.message).toBe('Account created successfully');
  });

  it('defers template and hero image generation via after()', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'merch-1', slug: 'test' },
            error: null,
          }),
        };
      }
      if (table === 'domains') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await POST(makeRequest(validBody));

    // after() should have been called with a callback (template + hero images)
    const { after } = await import('next/server');
    expect(after).toHaveBeenCalledTimes(1);
    expect(afterCallbacks).toHaveLength(1);
  });

  // --- Error catch-all ---

  it('returns generic 500 for unexpected errors (no message leak)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    // Throw an unexpected error during merchant lookup
    mockFrom.mockImplementation(() => {
      throw new Error('SECRET_DB_CONNECTION_STRING leaked');
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
    // Must NOT contain the actual error message
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_CONNECTION_STRING');
  });
});
