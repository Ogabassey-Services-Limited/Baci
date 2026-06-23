import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthActionState } from '@/app/actions/auth';
import type { LoginFormAction } from './login-form-types';
import { LoginPasswordlessEntry } from './login-passwordless-entry';

const formAction = vi.fn() as unknown as LoginFormAction;
const emptyState: AuthActionState = { error: null, success: false };

describe('LoginPasswordlessEntry', () => {
  it('renders the email-code request form with the redirect target', () => {
    const onBackToLogin = vi.fn();

    render(
      <LoginPasswordlessEntry
        email="admin@example.com"
        mode="passwordless-request"
        onBackToLogin={onBackToLogin}
        onUseDifferentEmail={vi.fn()}
        redirectTo="/dashboard"
        sendAction={formAction}
        sendState={emptyState}
        verifyAction={formAction}
        verifyState={emptyState}
      />
    );

    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.getByDisplayValue('/dashboard')).toHaveAttribute(
      'name',
      'redirectTo'
    );

    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });

  it('renders the verification form with the last successful send email', () => {
    const onUseDifferentEmail = vi.fn();

    render(
      <LoginPasswordlessEntry
        email="typed@example.com"
        mode="passwordless-verify"
        onBackToLogin={vi.fn()}
        onUseDifferentEmail={onUseDifferentEmail}
        redirectTo="/dashboard"
        sendAction={formAction}
        sendState={{
          email: 'sent@example.com',
          error: null,
          success: true,
        }}
        verifyAction={formAction}
        verifyState={emptyState}
      />
    );

    const tokenInput = screen.getByLabelText('Code');
    expect(tokenInput).toHaveAttribute('name', 'token');
    expect(tokenInput).toHaveAttribute('inputMode', 'numeric');
    expect(tokenInput).toHaveAttribute('maxLength', '6');
    expect(tokenInput).toHaveAttribute('pattern', '[0-9]{6}');
    expect(screen.getByDisplayValue('/dashboard')).toHaveAttribute(
      'name',
      'redirectTo'
    );
    expect(screen.getByDisplayValue('sent@example.com')).toHaveAttribute(
      'name',
      'email'
    );

    fireEvent.click(
      screen.getByRole('button', { name: /use a different email/i })
    );

    expect(onUseDifferentEmail).toHaveBeenCalledTimes(1);
  });

  it('prefers the verification state email over sent and typed values', () => {
    render(
      <LoginPasswordlessEntry
        email="typed@example.com"
        mode="passwordless-verify"
        onBackToLogin={vi.fn()}
        onUseDifferentEmail={vi.fn()}
        redirectTo="/dashboard"
        sendAction={formAction}
        sendState={{
          email: 'sent@example.com',
          error: null,
          success: true,
        }}
        verifyAction={formAction}
        verifyState={{
          email: 'verified@example.com',
          error: 'Try again',
          success: false,
        }}
      />
    );

    expect(screen.getByDisplayValue('verified@example.com')).toHaveAttribute(
      'name',
      'email'
    );
  });
});
