import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffAcceptPage, {
  StaffAcceptPageContent,
} from '@/app/(platform)/staff/accept/page';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Baci</span>,
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

const mockRpc = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe('StaffAcceptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a local fallback while runtime invitation data is pending', () => {
    const result = StaffAcceptPage({
      searchParams: new Promise(() => {
        // Intentionally unresolved to keep the Suspense fallback visible.
      }),
    });

    expect(result).not.toBeInstanceOf(Promise);

    render(result as ReactElement);

    expect(screen.getByRole('status')).toHaveTextContent('Checking invitation');
  });

  it('renders invalid-link state when token is missing', async () => {
    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({}),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Invalid Link' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Invitation token is required')
    ).toBeInTheDocument();
  });

  it('renders invalid-link state when token is malformed', async () => {
    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'invalid@token;drop table;' }),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Invalid Link' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Invalid invitation token characters')
    ).toBeInTheDocument();
  });

  it('renders invalid invitation state when preview RPC returns error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Invalid Invitation' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This invitation link is invalid, has expired, or has already been used/
      )
    ).toBeInTheDocument();
  });

  it('renders invalid invitation state when preview RPC returns empty array', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Invalid Invitation' })
    ).toBeInTheDocument();
  });

  it('renders invitation preview page (InvitePage) when user is not authenticated', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          merchant_business_name: 'OgaBassey Store',
          role: 'Admin',
          email: 'invitee@example.com',
        },
      ],
      error: null,
    });

    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: /you're invited!/i })
    ).toBeInTheDocument();
    expect(screen.getByText('OgaBassey Store')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('invitee@example.com')).toBeInTheDocument();
  });

  it('renders transient authentication error when auth getUser returns a non-401 error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          merchant_business_name: 'OgaBassey Store',
          role: 'Admin',
          email: 'invitee@example.com',
        },
      ],
      error: null,
    });

    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: {
        name: 'AuthInternalError',
        message: 'Database unreachable',
        status: 500,
      },
    });

    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Authentication Error' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A transient authentication failure occurred/)
    ).toBeInTheDocument();
  });

  it('renders wrong account error when authenticated user email does not match invitation email', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          merchant_business_name: 'OgaBassey Store',
          role: 'Admin',
          email: 'invitee@example.com',
        },
      ],
      error: null,
    });

    mockGetUser.mockResolvedValueOnce({
      data: { user: { email: 'wrong-user@example.com' } },
      error: null,
    });

    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Wrong Account' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This invitation was sent to invitee@example.com. Please sign in with that email address./
      )
    ).toBeInTheDocument();
  });

  it('renders expired invite error when accept RPC returns invite_expired', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            merchant_business_name: 'OgaBassey Store',
            role: 'Admin',
            email: 'invitee@example.com',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        error: { message: 'invite_expired' },
      });

    mockGetUser.mockResolvedValueOnce({
      data: { user: { email: 'invitee@example.com' } },
      error: null,
    });

    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Invitation Expired' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This invitation has expired. Please ask the store owner to send a new invitation./
      )
    ).toBeInTheDocument();
  });

  it('renders already accepted invite error when accept RPC returns invite_used', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            merchant_business_name: 'OgaBassey Store',
            role: 'Admin',
            email: 'invitee@example.com',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        error: { message: 'invite_used' },
      });

    mockGetUser.mockResolvedValueOnce({
      data: { user: { email: 'invitee@example.com' } },
      error: null,
    });

    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Already Accepted' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This invitation has already been accepted or used./)
    ).toBeInTheDocument();
  });

  it('renders generic accept error when accept RPC returns a generic error', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            merchant_business_name: 'OgaBassey Store',
            role: 'Admin',
            email: 'invitee@example.com',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        error: { message: 'unexpected_database_failure' },
      });

    mockGetUser.mockResolvedValueOnce({
      data: { user: { email: 'invitee@example.com' } },
      error: null,
    });

    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    render(result as ReactElement);

    expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Failed to accept the invitation. Please try again or contact support./
      )
    ).toBeInTheDocument();
  });

  it('successfully accepts invitation and redirects to dashboard', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            merchant_business_name: 'OgaBassey Store',
            role: 'Admin',
            email: 'invitee@example.com',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        error: null,
      });

    mockGetUser.mockResolvedValueOnce({
      data: { user: { email: 'invitee@example.com' } },
      error: null,
    });

    await StaffAcceptPageContent({
      searchParams: Promise.resolve({ token: 'valid-token-123' }),
    });

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
