import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoginFormShell } from './login-form-shell';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Baci</span>,
}));

describe('LoginFormShell', () => {
  it('renders the auth shell heading, child content, and legal links', () => {
    render(
      <LoginFormShell heading="Welcome back" subheading="Sign in">
        <button type="button">Continue</button>
      </LoginFormShell>
    );

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeDefined();
    expect(screen.getByText('Sign in')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Terms of Service' })
    ).toHaveAttribute('href', '/terms');
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' })
    ).toHaveAttribute('href', '/privacy');
  });
});
