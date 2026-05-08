import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSearchParams = vi.fn(() => new URLSearchParams());
const mockSignInWithOAuth = vi.fn(async () => ({ error: null }));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('@/app/actions/auth', () => ({
  forgotPasswordAction: vi.fn(),
  loginAction: vi.fn(),
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Baci</span>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

import LoginForm from './login-form';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('preserves the protected route redirectTo query parameter in the login action payload', () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams({ redirectTo: '/admin' })
    );

    const { container } = render(<LoginForm />);

    expect(container.querySelector('input[name="redirectTo"]')).toHaveAttribute(
      'value',
      '/admin'
    );
  });

  it('passes the protected redirect target through OAuth callbacks', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams({ redirectTo: '/admin' })
    );

    render(<LoginForm />);

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
});
