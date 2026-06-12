import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkPasswordBreach: vi.fn(),
  ensureActionRateLimit: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/auth-redirect', () => ({
  buildAbsoluteAppRedirectUrl: vi.fn(
    (path: string) => `https://app.example.com${path}`
  ),
  sanitizeRelativeRedirectPath: vi.fn(
    (path: string | null, fallback: string) => path || fallback
  ),
}));

vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mocks.ensureActionRateLimit,
}));

vi.mock('@/lib/password-breach', () => ({
  checkPasswordBreach: mocks.checkPasswordBreach,
}));

vi.mock('@/lib/routes', () => ({
  asRoute: vi.fn((route: string) => route),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { signUp: mocks.signUp },
  })),
}));

import { type SignupState, signupAction } from './actions';

const initialState: SignupState = {};

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.set('email', overrides.email ?? 'merchant@example.com');
  formData.set('password', overrides.password ?? 'Sup3r-Secure-Pass!');
  formData.set(
    'confirmPassword',
    overrides.confirmPassword ?? overrides.password ?? 'Sup3r-Secure-Pass!'
  );
  return formData;
}

describe('signupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureActionRateLimit.mockResolvedValue(true);
    mocks.checkPasswordBreach.mockResolvedValue({
      isBreached: false,
      count: 0,
    });
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('returns a rate-limit message without signing up when rate limited', async () => {
    mocks.ensureActionRateLimit.mockResolvedValue(false);

    const result = await signupAction(initialState, buildFormData());

    expect(result).toEqual({
      message: 'Too many signup attempts. Please try again in a few minutes.',
    });
    expect(mocks.ensureActionRateLimit).toHaveBeenCalledWith('signup', {
      requests: 5,
      windowMs: 900_000,
    });
    expect(mocks.checkPasswordBreach).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('returns field errors distinct from the rate-limit result for invalid input', async () => {
    const result = await signupAction(
      initialState,
      buildFormData({ email: 'not-an-email' })
    );

    expect(result.message).toBe('Invalid fields');
    expect(result.errors?.fieldErrors?.email).toBeDefined();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('blocks breached passwords before calling signUp', async () => {
    mocks.checkPasswordBreach.mockResolvedValue({
      isBreached: true,
      count: 42,
    });

    const result = await signupAction(initialState, buildFormData());

    expect(result.message).toBe('Security Alert');
    expect(result.errors?.fieldErrors?.password?.[0]).toContain(
      'data breaches'
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('signs the user up and redirects to verification on success', async () => {
    await signupAction(initialState, buildFormData());

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'merchant@example.com',
      password: 'Sup3r-Secure-Pass!',
      options: {
        emailRedirectTo: 'https://app.example.com/dashboard',
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining('/verify?email=')
    );
  });

  it('returns the Supabase error message when signUp fails', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email already registered' },
    });

    const result = await signupAction(initialState, buildFormData());

    expect(result).toEqual({ message: 'Email already registered' });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
