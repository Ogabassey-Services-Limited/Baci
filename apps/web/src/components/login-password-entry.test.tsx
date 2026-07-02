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

    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));
    fireEvent.click(toggleButton);

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
    expect(onPasswordlessRequest).toHaveBeenCalledTimes(1);
    expect(onTogglePassword).toHaveBeenCalledTimes(1);
  });

  it('keeps the password toggle name stable while exposing pressed state', () => {
    const onTogglePassword = vi.fn();
    const props = {
      action: formAction,
      defaultEmail: 'admin@example.com',
      disabled: false,
      onForgotPassword: vi.fn(),
      onPasswordlessRequest: vi.fn(),
      onTogglePassword,
      redirectTo: '/dashboard/orders',
    };

    const { rerender } = render(
      <LoginPasswordEntry {...props} showPassword={false} />
    );

    const collapsedToggle = screen.getByRole('button', {
      name: 'Show password',
    });
    expect(collapsedToggle).toHaveAttribute('aria-pressed', 'false');

    rerender(<LoginPasswordEntry {...props} showPassword />);

    const expandedToggle = screen.getByRole('button', {
      name: 'Show password',
    });
    expect(expandedToggle).toHaveAttribute('aria-pressed', 'true');
  });
});
