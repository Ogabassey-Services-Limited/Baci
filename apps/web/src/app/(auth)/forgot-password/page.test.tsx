import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResetPasswordForEmail = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}));

import ForgotPasswordPage from './page';

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it('requests a reset link with the update-password redirect URL', async () => {
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'merchant@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'merchant@example.com',
        {
          redirectTo: `${window.location.origin}/update-password`,
        }
      );
    });
    expect(
      await screen.findByText('Check your email for the password reset link')
    ).toBeVisible();
  });

  it('shows the Supabase reset error without leaving the form loading', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'Reset email is unavailable' },
    });

    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'merchant@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText('Reset email is unavailable')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Send Reset Link' })
    ).toBeEnabled();
  });
});
