import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignInWithOAuth = vi.fn(async () => ({ error: null }));
const mockSignInWithPasskey = vi.fn<
  () => Promise<{ error: { message: string } | null }>
>(async () => ({ error: null }));
const mockToast = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/app/actions/auth', () => ({
  forgotPasswordAction: vi.fn(),
  loginAction: vi.fn(),
  sendMerchantPasswordlessLoginAction: vi.fn(),
  verifyMerchantPasswordlessLoginAction: vi.fn(),
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Baci</span>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signInWithPasskey: mockSignInWithPasskey,
    },
  }),
}));

import LoginForm from './login-form';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('preserves the protected route redirect parameter in the login action payload', () => {
    render(<LoginForm defaultEmail="" redirectTo="/admin" />);

    expect(screen.getByDisplayValue('/admin')).toHaveAttribute(
      'name',
      'redirectTo'
    );
  });

  it('sanitizes unsafe redirect props before submitting or starting OAuth', async () => {
    render(
      <LoginForm defaultEmail="" redirectTo="https://evil.example/admin" />
    );

    expect(screen.getByDisplayValue('/dashboard')).toHaveAttribute(
      'name',
      'redirectTo'
    );

    fireEvent.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback?next=%2Fdashboard',
        },
      });
    });
  });

  it.each([
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['protocol-relative URL', '//evil.example/admin'],
    ['backslash URL confusion', '/\\evil.example/admin'],
    ['control characters', '/admin\n//evil.example'],
  ])('sanitizes unsafe %s redirects to the dashboard', (_label, redirectTo) => {
    render(<LoginForm defaultEmail="" redirectTo={redirectTo} />);

    expect(screen.getByDisplayValue('/dashboard')).toHaveAttribute(
      'name',
      'redirectTo'
    );
  });

  it('passes the protected redirect target through OAuth callbacks', async () => {
    render(<LoginForm defaultEmail="" redirectTo="/admin" />);

    fireEvent.click(screen.getByRole('button', { name: /google/i }));

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback?next=%2Fadmin',
        },
      });
    });
  });

  it('shows an error toast and re-enables OAuth when Google sign-in fails', async () => {
    mockSignInWithOAuth.mockRejectedValueOnce(new Error('OAuth unavailable'));

    render(<LoginForm defaultEmail="" redirectTo="/dashboard" />);

    const googleButton = screen.getByRole('button', { name: /google/i });

    fireEvent.click(googleButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'OAuth unavailable',
        title: 'Google Sign-in Failed',
        variant: 'destructive',
      });
    });
    expect(googleButton).toBeEnabled();
  });

  it('uses the server-provided default email without reading search params in the client', () => {
    render(<LoginForm defaultEmail="admin@example.com" redirectTo="/admin" />);

    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
  });

  it('opens the merchant email-code login mode with the default email', () => {
    render(<LoginForm defaultEmail="admin@example.com" redirectTo="/admin" />);

    fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));

    expect(screen.getByRole('heading', { name: 'Email Code' })).toBeDefined();
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.getByDisplayValue('/admin')).toHaveAttribute(
      'name',
      'redirectTo'
    );
  });

  it('starts passkey sign-in only when the passkey feature flag is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED', 'true');
    mockSignInWithPasskey.mockResolvedValueOnce({
      error: { message: 'cancelled' },
    });

    render(<LoginForm defaultEmail="" redirectTo="/dashboard" />);

    fireEvent.click(screen.getByRole('button', { name: /passkey/i }));

    await waitFor(() => {
      expect(mockSignInWithPasskey).toHaveBeenCalledTimes(1);
    });
  });
});
