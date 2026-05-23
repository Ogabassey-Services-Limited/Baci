import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InvitePage from './InvitePage';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('InvitePage', () => {
  it('renders the invitation details correctly', () => {
    render(
      // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
      <InvitePage
        merchantName="OgaBassey Store"
        role="Admin"
        inviteEmail="invitee@example.com"
        token="token-abc-123"
      />
    );

    expect(
      screen.getByRole('heading', { name: /you're invited!/i })
    ).toBeInTheDocument();
    expect(screen.getByText('OgaBassey Store')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('invitee@example.com')).toBeInTheDocument();
  });

  it('renders sign in and sign up links with correct token-aware redirects', () => {
    render(
      // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
      <InvitePage
        merchantName="OgaBassey Store"
        role="Admin"
        inviteEmail="invitee@example.com"
        token="token-abc-123"
      />
    );

    const signInLink = screen.getByRole('link', { name: /sign in to accept/i });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute(
      'href',
      '/login?redirect=%2Fstaff%2Faccept%3Ftoken%3Dtoken-abc-123'
    );

    const signUpLink = screen.getByRole('link', { name: /create one/i });
    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink).toHaveAttribute(
      'href',
      '/signup?email=invitee%40example.com&redirect=%2Fstaff%2Faccept%3Ftoken%3Dtoken-abc-123'
    );
  });
});
