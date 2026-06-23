import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoginSocialOptions } from './login-social-options';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('LoginSocialOptions', () => {
  it('renders provider controls and routes clicks to the supplied handlers', () => {
    const onAppleSignIn = vi.fn();
    const onGoogleSignIn = vi.fn();
    const onPasskeySignIn = vi.fn();

    render(
      <LoginSocialOptions
        disabled={false}
        isAppleLoading={false}
        isGoogleLoading={false}
        isPasskeyEnabled
        isPasskeyLoading={false}
        onAppleSignIn={onAppleSignIn}
        onGoogleSignIn={onGoogleSignIn}
        onPasskeySignIn={onPasskeySignIn}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /google/i }));
    fireEvent.click(screen.getByRole('button', { name: /apple/i }));
    fireEvent.click(screen.getByRole('button', { name: /passkey/i }));

    expect(onGoogleSignIn).toHaveBeenCalledTimes(1);
    expect(onAppleSignIn).toHaveBeenCalledTimes(1);
    expect(onPasskeySignIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
      'href',
      '/onboarding'
    );
  });

  it('hides passkey sign-in when the feature is disabled', () => {
    render(
      <LoginSocialOptions
        disabled={false}
        isAppleLoading={false}
        isGoogleLoading={false}
        isPasskeyEnabled={false}
        isPasskeyLoading={false}
        onAppleSignIn={vi.fn()}
        onGoogleSignIn={vi.fn()}
        onPasskeySignIn={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /passkey/i })).toBeNull();
  });
});
