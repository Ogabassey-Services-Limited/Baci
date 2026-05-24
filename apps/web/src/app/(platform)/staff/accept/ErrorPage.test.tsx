import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ErrorPage from './ErrorPage';

interface MockLinkProps extends ComponentProps<'a'> {
  children: ReactNode;
  href: string;
}

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: MockLinkProps) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('ErrorPage', () => {
  it('renders title and error message correctly', () => {
    render(<ErrorPage title="Test Title" message="Test message content" />);

    expect(
      screen.getByRole('heading', { name: /test title/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  it('shows currently signed in email when provided', () => {
    render(
      <ErrorPage
        title="Error"
        message="Message"
        currentEmail="user@example.com"
      />
    );

    expect(screen.getByText('Currently signed in as:')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('renders standard return home link', () => {
    render(<ErrorPage title="Error" message="Message" />);

    const homeLink = screen.getByRole('link', { name: /return home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('shows custom login button with token-aware redirect when loginRedirect is provided', () => {
    render(
      <ErrorPage
        title="Error"
        message="Message"
        showLoginLink
        loginRedirect="/staff/accept?token=invite-token-123"
      />
    );

    const loginButton = screen.getByRole('link', {
      name: /sign in with different account/i,
    });
    expect(loginButton).toBeInTheDocument();
    expect(loginButton).toHaveAttribute(
      'href',
      '/login?redirect=%2Fstaff%2Faccept%3Ftoken%3Dinvite-token-123'
    );
  });

  it('shows standard login button when showLoginLink is true but loginRedirect is absent', () => {
    render(<ErrorPage title="Error" message="Message" showLoginLink />);

    const loginButton = screen.getByRole('link', {
      name: /sign in with different account/i,
    });
    expect(loginButton).toBeInTheDocument();
    expect(loginButton).toHaveAttribute('href', '/login');
  });
});
