import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LoginFormAction } from './login-form-types';
import { LoginPasswordEntry } from './login-password-entry';

const formAction = vi.fn() as unknown as LoginFormAction;

describe('LoginPasswordEntry', () => {
  it('renders password login fields and preserves the redirect target', () => {
    const onForgotPassword = vi.fn();
    const onPasswordlessRequest = vi.fn();
    const onTogglePassword = vi.fn();

    render(
      <LoginPasswordEntry
        action={formAction}
        defaultEmail="admin@example.com"
        disabled={false}
        onForgotPassword={onForgotPassword}
        onPasswordlessRequest={onPasswordlessRequest}
        onTogglePassword={onTogglePassword}
        redirectTo="/dashboard/orders"
        showPassword={false}
      />
    );

    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password'
    );
    expect(screen.getByDisplayValue('/dashboard/orders')).toHaveAttribute(
      'name',
      'redirectTo'
    );

    const toggleBtn = screen.getByRole('button', { name: 'Show password' });
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));
    fireEvent.click(toggleBtn);

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
    expect(onPasswordlessRequest).toHaveBeenCalledTimes(1);
    expect(onTogglePassword).toHaveBeenCalledTimes(1);
  });
});
