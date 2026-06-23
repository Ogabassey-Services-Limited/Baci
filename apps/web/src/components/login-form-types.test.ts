import { describe, expect, it } from 'vitest';
import type { LoginFormAction, LoginMode } from './login-form-types';

describe('login-form-types', () => {
  it('enumerates the four supported login modes', () => {
    // The typed array fails to compile if a mode is removed/renamed,
    // pinning the LoginMode union as the login form's source of truth.
    const modes: LoginMode[] = [
      'login',
      'forgot-password',
      'passwordless-request',
      'passwordless-verify',
    ];

    expect(new Set(modes).size).toBe(4);
  });

  it('treats a form action callback as a valid LoginFormAction', () => {
    const action: LoginFormAction = () => undefined;

    expect(typeof action).toBe('function');
  });
});
