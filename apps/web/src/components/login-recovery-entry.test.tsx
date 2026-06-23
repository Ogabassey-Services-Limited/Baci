import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LoginFormAction } from './login-form-types';
import { LoginRecoveryEntry } from './login-recovery-entry';

const formAction = vi.fn() as unknown as LoginFormAction;

describe('LoginRecoveryEntry', () => {
  it('renders reset email form and allows returning to sign in', () => {
    const onBackToLogin = vi.fn();

    render(
      <LoginRecoveryEntry action={formAction} onBackToLogin={onBackToLogin} />
    );

    expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'email');
    expect(
      screen.getByRole('button', { name: /send reset link/i })
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});
