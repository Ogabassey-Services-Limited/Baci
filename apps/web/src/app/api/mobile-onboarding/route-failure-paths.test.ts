import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Failure-path scenarios for POST /api/mobile-onboarding, split out of
 * route.test.ts so the happy-path suite stops growing. Covers the 2026-07-22
 * signup outage regression and the recovery contract that came out of it.
 */

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
const afterCallbacks: Array<() => Promise<void>> = [];

vi.mock('@/lib/password-breach', () => ({
  checkPasswordBreach: vi
    .fn()
    .mockResolvedValue({ isBreached: false, count: 0 }),
}));

vi.mock('next/headers', () => ({
  cookies: vi
    .fn()
    .mockResolvedValue({ getAll: () => [], get: () => null, set: vi.fn() }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseServer),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
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

import {
  makeOnboardingRequest,
  validOnboardingBody,
} from './onboarding-request.test-support';
import { POST } from './route';

describe('POST /api/mobile-onboarding failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mockRpc.mockResolvedValue({ data: 'generated-mobile-slug', error: null });
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
      const res = await POST(makeOnboardingRequest(validOnboardingBody));
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
    const res = await POST(
      makeOnboardingRequest(validOnboardingBody, {
        authorization: 'Bearer app-session',
      })
    );
    const body = await res.json();

    // Assert
    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to check existing account.');
    expect(body.code).toBe('onboarding_failed');
  });

  it('finishes provisioning and repairs the domain when its insert fails', async () => {
    // Fails on the caller-scoped insert, then succeeds on the scoped retry.
    const domainInsert = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation', code: '42501' },
      })
      .mockResolvedValue({ data: null, error: null });

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
        return { insert: domainInsert };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await POST(makeOnboardingRequest(validOnboardingBody));
    const body = await res.json();

    // The merchant row is already committed, so aborting here would leave the
    // account half-provisioned AND unrepairable: after sign-in, (auth)/_layout
    // sends a user who HAS a merchant straight to the dashboard, never back
    // through this endpoint.
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // The address is derived from the merchant, so after() retries it with no
    // user action — on the SAME caller-scoped client, never service-role, so a
    // real policy denial stays visible instead of being forced through.
    await Promise.all(afterCallbacks.map((cb) => cb()));
    expect(domainInsert).toHaveBeenCalledTimes(2);
    expect(domainInsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        merchant_id: 'merch-1',
        domain: 'test.usebaci.com',
        is_primary: true,
      })
    );
    expect(mockAdminFrom).not.toHaveBeenCalledWith('domains');
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
    const res = await POST(
      makeOnboardingRequest(validOnboardingBody, {
        authorization: 'Bearer app-session',
      })
    );
    const body = await res.json();

    // Assert
    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
    expect(body.code).toBe('onboarding_failed');
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_CONNECTION_STRING');
  });

  describe('bugfix: a cookie-authenticated retry got the dead-end 500', () => {
    it('still offers recovery when signUp is skipped because the signup cookie authenticated the retry', async () => {
      // Arrange: this is what a real retry from the register screen looks like.
      // The earlier signUp set cookies that iOS fetch keeps, so getUser()
      // succeeds and the signUp block is skipped entirely — yet the APP holds
      // no session, which is why it sends no Authorization header. Provisioning
      // is still failing, as during the outage.
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: Object.assign(new Error('rls'), { code: '42501' }),
        }),
      }));

      // Act — no Authorization header: the client owns no session.
      const res = await POST(makeOnboardingRequest(validOnboardingBody));
      const body = await res.json();

      // Assert: without this the retry fell back to the generic 500 and the
      // user was told nothing actionable, forever.
      expect(res.status).toBe(500);
      expect(body.code).toBe('account_created_store_setup_failed');
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });
});
