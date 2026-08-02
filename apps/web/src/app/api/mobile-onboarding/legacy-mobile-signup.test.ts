import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  signUp: vi.fn(),
  checkPasswordBreach: vi.fn(),
  resolveMerchant: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));
vi.mock('@/lib/password-breach', () => ({
  checkPasswordBreach: mocks.checkPasswordBreach,
}));
vi.mock('@/lib/resolve-merchant-by-slug', () => ({
  resolveMerchantIdBySlugOrAlias: mocks.resolveMerchant,
}));
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'anon-key',
}));

import { runLegacyMobileSignup } from './legacy-mobile-signup';

function request(authorization?: string): NextRequest {
  return new NextRequest('https://usebaci.com/api/mobile-onboarding', {
    headers: authorization ? { Authorization: authorization } : undefined,
  });
}

const input = {
  request: request(),
  email: 'ada@example.com',
  password: 'StrongP@ss123!',
  firstName: 'Ada',
  lastName: 'Lovelace',
  slug: 'analytical-engines',
  slugIsCustom: true,
};

describe('runLegacyMobileSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser, signUp: mocks.signUp },
    });
    mocks.checkPasswordBreach.mockResolvedValue({
      isBreached: false,
      count: 0,
    });
    mocks.resolveMerchant.mockResolvedValue({
      merchantId: null,
      error: null,
    });
  });

  it('reuses a verified bearer session without signing up again', async () => {
    const user = { id: 'user-1', email: 'ada@example.com' };
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });

    await expect(
      runLegacyMobileSignup({
        ...input,
        request: request('Bearer app-session'),
      })
    ).resolves.toMatchObject({
      ok: true,
      user,
      accountCreated: false,
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.checkPasswordBreach).not.toHaveBeenCalled();
  });

  it('keeps the breached-password check on anonymous v1 signup', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.checkPasswordBreach.mockResolvedValue({
      isBreached: true,
      count: 42,
    });

    const result = await runLegacyMobileSignup(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toMatchObject({
        error: expect.stringMatching(/42 known data breaches/i),
      });
    }
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('returns slug_unavailable before creating an auth account', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.resolveMerchant.mockResolvedValue({
      merchantId: 'other-merchant',
      error: null,
    });

    const result = await runLegacyMobileSignup(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(409);
      await expect(result.response.json()).resolves.toEqual({
        error: 'That store URL is unavailable. Please choose another.',
        code: 'slug_unavailable',
      });
    }
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('maps an existing email independently from a store-link collision', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', status: 422 },
    });

    const result = await runLegacyMobileSignup({
      ...input,
      slugIsCustom: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(409);
      await expect(result.response.json()).resolves.toEqual({
        error: 'User already exists. Please log in.',
        code: 'account_exists',
      });
    }
  });

  it('returns the new user with a caller-scoped access-token client', async () => {
    const user = { id: 'user-1', email: 'ada@example.com' };
    const initialClient = {
      auth: { getUser: mocks.getUser, signUp: mocks.signUp },
    };
    const scopedClient = { auth: { getUser: vi.fn() }, rpc: vi.fn() };
    mocks.createClient
      .mockReturnValueOnce(initialClient)
      .mockReturnValueOnce(scopedClient);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.signUp.mockResolvedValue({
      data: { user, session: { access_token: 'new-token' } },
      error: null,
    });

    await expect(runLegacyMobileSignup(input)).resolves.toEqual({
      ok: true,
      user,
      supabase: scopedClient,
      accountCreated: true,
    });
    expect(mocks.createClient).toHaveBeenLastCalledWith(
      'https://test.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer new-token' } },
      })
    );
  });
});
