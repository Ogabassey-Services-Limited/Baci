import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEnsureActionRateLimit,
  mockRedirect,
  mockResetPasswordForEmail,
  mockSignInWithPassword,
} = vi.hoisted(() => ({
  mockEnsureActionRateLimit: vi.fn(),
  mockRedirect: vi.fn(),
  mockResetPasswordForEmail: vi.fn(),
  mockSignInWithPassword: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: () => null,
    getAll: () => [],
    set: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('@/env', () => ({
  getAppUrl: vi.fn(() => 'http://localhost:3000'),
}));

vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mockEnsureActionRateLimit,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  })),
}));

import { forgotPasswordAction, loginAction } from './auth';

const prevState = { error: null, success: false };

function makeFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureActionRateLimit.mockResolvedValue(true);
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  it('returns a rate-limit error without attempting a sign-in', async () => {
    mockEnsureActionRateLimit.mockResolvedValueOnce(false);

    const result = await loginAction(
      prevState,
      makeFormData({ email: 'user@example.com', password: 'password123' })
    );

    expect(result).toEqual({
      error: 'Too many login attempts. Please try again later.',
      success: false,
    });
    expect(mockEnsureActionRateLimit).toHaveBeenCalledWith('login', {
      requests: 10,
      windowMs: 60_000,
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('rejects an invalid email without attempting a sign-in', async () => {
    const result = await loginAction(
      prevState,
      makeFormData({ email: 'not-an-email', password: 'password123' })
    );

    expect(result).toEqual({
      error: 'Please enter a valid email address.',
      success: false,
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('lets existing short passwords reach Supabase credential validation', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });

    const result = await loginAction(
      prevState,
      makeFormData({ email: 'user@example.com', password: 'short' })
    );

    expect(result).toEqual({
      error: 'Invalid login credentials',
      success: false,
    });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'short',
    });
  });

  it('returns the supabase error message when credentials are wrong', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });

    const result = await loginAction(
      prevState,
      makeFormData({ email: 'user@example.com', password: 'password123' })
    );

    expect(result).toEqual({
      error: 'Invalid login credentials',
      success: false,
    });
  });

  it('signs in and redirects to the dashboard on success', async () => {
    await loginAction(
      prevState,
      makeFormData({ email: 'user@example.com', password: 'password123' })
    );

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('falls back to the dashboard when redirectTo is not a safe relative path', async () => {
    await loginAction(
      prevState,
      makeFormData({
        email: 'user@example.com',
        password: 'password123',
        redirectTo: 'https://evil.example.com/phish',
      })
    );

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('honors a safe relative redirectTo path', async () => {
    await loginAction(
      prevState,
      makeFormData({
        email: 'user@example.com',
        password: 'password123',
        redirectTo: '/dashboard/orders',
      })
    );

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/orders');
  });
});

describe('forgotPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureActionRateLimit.mockResolvedValue(true);
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it('returns a rate-limit error without sending a reset email', async () => {
    mockEnsureActionRateLimit.mockResolvedValueOnce(false);

    const result = await forgotPasswordAction(
      prevState,
      makeFormData({ email: 'user@example.com' })
    );

    expect(result).toEqual({
      error: 'Too many password reset requests. Please try again later.',
      success: false,
    });
    expect(mockEnsureActionRateLimit).toHaveBeenCalledWith('forgot-password', {
      requests: 3,
      windowMs: 900_000,
    });
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('rejects an invalid email without sending a reset email', async () => {
    const result = await forgotPasswordAction(
      prevState,
      makeFormData({ email: 'nope' })
    );

    expect(result).toEqual({
      error: 'Please enter a valid email address.',
      success: false,
    });
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sends the reset email with the reset-password redirect on success', async () => {
    const result = await forgotPasswordAction(
      prevState,
      makeFormData({ email: 'user@example.com' })
    );

    expect(result).toEqual({ error: null, success: true });
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: expect.stringContaining('/reset-password'),
    });
  });

  it('returns the supabase error message when the reset request fails', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'Email rate limit exceeded' },
    });

    const result = await forgotPasswordAction(
      prevState,
      makeFormData({ email: 'user@example.com' })
    );

    expect(result).toEqual({
      error: 'Email rate limit exceeded',
      success: false,
    });
  });
});
