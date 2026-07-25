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
  country: 'NG',
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
    // signUp succeeded above, so this caller owns an account with no store and
    // gets the recoverable outcome — a lookup failure strands them exactly like
    // a thrown error does.
    expect(body.code).toBe('account_created_store_setup_failed');
  });

  it('returns the specific lookup message when no account was created', async () => {
    // Arrange: authenticated caller, so signUp never runs.
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
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

    // Act
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    // Assert
    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to check existing account.');
    expect(body.code).toBe('onboarding_failed');
  });

  it('retries an autogenerated slug via generate_slug when it collides with a retired alias, then succeeds', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });
    // generate_slug returns a fresh, alias-free slug for the retry.
    mockRpc.mockResolvedValue({ data: 'test-1', error: null });

    // First INSERT collides (retired-alias trigger -> 23505); the retry with the
    // generate_slug()-resolved slug succeeds.
    const singleMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'slug_is_retired_alias' },
      })
      .mockResolvedValueOnce({
        data: { id: 'merch-1', slug: 'test-1' },
        error: null,
      });
    const insertSpy = vi.fn().mockReturnThis();
    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: insertSpy,
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: singleMock,
    };

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
    expect(body.merchant.slug).toBe('test-1');
    // Inserted twice (original + retry) and consulted generate_slug for the retry.
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith('generate_slug', {
      text_input: expect.any(String),
    });
  });

  it('returns 409 when even the retried slug collides (concurrent race)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: 'test-1', error: null });

    // Both the original and the retried INSERT collide -> genuine race -> 409.
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: singleMock,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return merchantQuery;
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe(
      'That store URL is unavailable. Please choose another.'
    );
  });

  describe('bugfix: RLS rejection after signup left an unrecoverable orphan', () => {
    it('tells the caller their account exists when the merchant INSERT is denied by RLS', async () => {
      // Arrange: reproduce the 2026-07-22..07-25 outage — signUp succeeds, then
      // the merchant INSERT ... RETURNING is rejected 42501 by the authenticated
      // SELECT policy. This used to surface as a bare "Internal Server Error",
      // leaving an auth user with no store and no route forward.
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'user-1', email: 'test@example.com' },
          session: { access_token: 'tok-123' },
        },
        error: null,
      });

      const merchantQuery = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: Object.assign(
            new Error(
              'new row violates row-level security policy for table "merchants"'
            ),
            { code: '42501', details: null, hint: null }
          ),
        }),
      };
      mockFrom.mockImplementation((table: string) =>
        table === 'merchants'
          ? merchantQuery
          : { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
      );

      // Act
      const res = await POST(makeRequest(validBody));
      const body = await res.json();

      // Assert: a recoverable, machine-readable outcome instead of a dead end.
      expect(res.status).toBe(500);
      expect(body.code).toBe('account_created_store_setup_failed');
      expect(body.error).toMatch(/sign in/i);

      // ...and the Postgres code reaches the log, which is what made this
      // outage invisible for three days.
      expect(errorSpy).toHaveBeenCalledWith(
        'mobile-onboarding deployment_fault',
        expect.stringContaining('"pgCode":"42501"')
      );

      errorSpy.mockRestore();
    });
  });

  it('preflights an EXPLICIT user-chosen slug and 409s BEFORE signup (no orphaned auth user, no silent change)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    const insertSpy = vi.fn().mockReturnThis();
    // Preflight: the explicit slug is already taken by a live merchant.
    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: insertSpy,
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'existing-merchant' }, error: null }),
      single: vi.fn(),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'merchants'
        ? merchantQuery
        : { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
    );

    // User explicitly typed a Store Link -> client sends `slug`.
    const res = await POST(
      makeRequest({ ...validBody, slug: 'my-chosen-url', slugIsCustom: true })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe(
      'That store URL is unavailable. Please choose another.'
    );
    // Distinct code so the mobile client shows "choose another URL", not "go to login".
    expect(body.code).toBe('slug_unavailable');
    // Rejected BEFORE signup + before any merchant insert — no orphaned auth user.
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("treats a LEGACY client's slug (no slugIsCustom flag) as an explicit choice", async () => {
    // Pre-slugIsCustom clients had an editable Store Link and send `slug` WITHOUT
    // the flag. That is a real user choice, so an omitted flag must be explicit:
    // a taken slug 409s before signup, never silently provisions `chosen-1`.
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    const insertSpy = vi.fn().mockReturnThis();
    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: insertSpy,
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'existing-merchant' }, error: null }),
      single: vi.fn(),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'merchants'
        ? merchantQuery
        : { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
    );

    // No slugIsCustom flag (legacy client).
    const res = await POST(
      makeRequest({ ...validBody, slug: 'my-chosen-url' })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('slug_unavailable');
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('fails CLOSED (503) without signing up when the explicit-slug preflight lookup errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    // Preflight query fails transiently.
    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'db down' } }),
      single: vi.fn(),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'merchants'
        ? merchantQuery
        : { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
    );

    const res = await POST(
      makeRequest({ ...validBody, slug: 'my-chosen-url', slugIsCustom: true })
    );

    expect(res.status).toBe(503);
    // Must NOT create an auth user when availability can't be verified.
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('409s an EXPLICIT reserved slug BEFORE signup and before any preflight lookup', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    const maybeSingleSpy = vi.fn();
    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: maybeSingleSpy,
      single: vi.fn(),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'merchants'
        ? merchantQuery
        : { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
    );

    // 'www' is an INFRA subdomain (not in RESERVED_PATHS but in the DB guard): it
    // could be inserted but would never resolve. Reject it up-front so it doesn't
    // orphan a just-created auth user — the exact gap the full reserved check closes.
    const res = await POST(
      makeRequest({ ...validBody, slug: 'www', slugIsCustom: true })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('slug_unavailable');
    expect(mockSignUp).not.toHaveBeenCalled();
    // Rejected on the reserved check alone — never ran the availability preflight.
    expect(maybeSingleSpy).not.toHaveBeenCalled();
  });

  it('409s an EXPLICIT over-63-char slug BEFORE signup (enforced in the route, not Zod)', async () => {
    // The shared schema no longer rejects long slugs (it can't tell signup from
    // completion); the signup path caps at 63 so it fails before signUp instead of
    // orphaning an auth user on the DB trigger's 23505.
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    const maybeSingleSpy = vi.fn();
    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: maybeSingleSpy,
      single: vi.fn(),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'merchants'
        ? merchantQuery
        : { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
    );

    const res = await POST(
      makeRequest({ ...validBody, slug: 'a'.repeat(80), slugIsCustom: true })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('slug_unavailable');
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(maybeSingleSpy).not.toHaveBeenCalled();
  });

  it('409s an EXPLICIT slug collision on profile completion instead of silently suffixing', async () => {
    // Authenticated user completing an incomplete merchant (no slug yet) who typed
    // an explicit Store Link that is already taken. The explicit choice must be
    // honored verbatim -> 23505 -> 409, NOT de-duped to a different URL by generate_slug.
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'm-existing', business_name: 'Old Name', slug: null },
        error: null,
      }),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: '23505' } }),
    };
    mockFrom.mockImplementation((table: string) =>
      table === 'merchants'
        ? merchantQuery
        : { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
    );

    const res = await POST(
      makeRequest({ ...validBody, slug: 'taken-url', slugIsCustom: true })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('slug_unavailable');
    // Honored verbatim: no generate_slug de-dup RPC was issued for the explicit slug.
    expect(mockRpc).not.toHaveBeenCalledWith(
      'generate_slug',
      expect.anything()
    );
  });

  it('de-dupes a LEGACY completion slug (no slugIsCustom flag) via generate_slug, not 409', async () => {
    // Completing an incomplete merchant with a LEGACY client (omitted flag). No
    // signup happens, so there's no auth user to orphan — preserve the ORIGINAL
    // auto de-dup behavior for omitted-flag requests instead of 409ing on collision.
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });

    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'm-existing', business_name: 'Old Name', slug: null },
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: { id: 'm-existing', slug: 'generated-mobile-slug' },
        error: null,
      }),
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return merchantQuery;
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    // Legacy client: slug provided, slugIsCustom OMITTED.
    const res = await POST(
      makeRequest({ ...validBody, slug: 'auto-filled-url' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.merchant.slug).toBe('generated-mobile-slug');
    // Auto de-dup: generate_slug WAS issued (not honored verbatim → no 409).
    expect(mockRpc).toHaveBeenCalledWith('generate_slug', expect.anything());
  });

  it('provisions the DISPLAYED auto-slug (not a re-derived first-word) when it is free', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    const insertSpy = vi.fn().mockReturnThis();
    const merchantQuery = {
      select: vi.fn().mockReturnThis(),
      insert: insertSpy,
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({
        data: { id: 'm1', slug: 'janes-store' },
        error: null,
      }),
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return merchantQuery;
      }
      if (table === 'staff_members') {
        return {
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    // UI prefilled + sent "janes-store" (not user-edited). Server must provision
    // exactly that when free — not its own first-word derivation ("janes").
    const res = await POST(
      makeRequest({
        ...validBody,
        businessName: 'Janes Store',
        slug: 'janes-store',
        slugIsCustom: false,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.merchant.slug).toBe('janes-store');
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'janes-store' })
    );
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
        country: 'NG',
        payout_currency: 'NGN',
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
    // Post-signUp again: the account and merchant exist but the store is
    // unreachable, so the caller is pointed at sign-in rather than a dead end.
    expect(body.code).toBe('account_created_store_setup_failed');
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

  it('upserts the owner staff profile with a valid staff role and user-merchant conflict target', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    const staffUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
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
          upsert: staffUpsert,
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(staffUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        merchant_id: 'merch-1',
        role: 'admin',
        status: 'active',
      }),
      { onConflict: 'user_id,merchant_id' }
    );
  });

  it('returns success for valid new registration', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com' },
        session: { access_token: 'tok-123' },
      },
      error: null,
    });

    const merchantInsert = vi.fn().mockReturnThis();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: merchantInsert,
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
    expect(merchantInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'NG',
        payout_currency: 'NGN',
      })
    );
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
    // The signUp above succeeded, so this caller owns an account with no store:
    // they get the recoverable "sign in to finish setup" outcome rather than a
    // dead-end generic 500. The no-leak guarantee below is unchanged.
    expect(body.code).toBe('account_created_store_setup_failed');
    // Must NOT contain the actual error message
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_CONNECTION_STRING');
  });

  it('returns a generic 500 with no message leak when the failure precedes signup', async () => {
    // Arrange: an authenticated caller (no signUp runs), so there is no
    // just-created account to recover into — the response stays generic.
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null,
    });
    mockFrom.mockImplementation(() => {
      throw new Error('SECRET_DB_CONNECTION_STRING leaked');
    });

    // Act
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    // Assert
    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
    expect(body.code).toBe('onboarding_failed');
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_CONNECTION_STRING');
  });
});
