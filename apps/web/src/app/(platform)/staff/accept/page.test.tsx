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

interface SearchParamsInput {
  token?: string | string[];
}

const mockInvite = {
  merchant_business_name: 'OgaBassey Store',
  role: 'Admin',
  email: 'invitee@example.com',
};

async function renderPageContent(
  searchParams: SearchParamsInput,
  mockRpcValues: any[],
  mockUserValue?: any
) {
  for (const val of mockRpcValues) {
    mockRpc.mockResolvedValueOnce(val);
  }
  if (mockUserValue !== undefined) {
    mockGetUser.mockResolvedValueOnce(mockUserValue);
  }
  const result = await StaffAcceptPageContent({
    searchParams: Promise.resolve(searchParams),
  });
  render(result as ReactElement);
}

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
    await renderPageContent({}, []);
    expect(
      screen.getByRole('heading', { name: 'Invalid Link' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Invitation token is required')
    ).toBeInTheDocument();
  });

  it('renders invalid-link state when token is malformed', async () => {
    await renderPageContent({ token: 'invalid@token;drop table;' }, []);
    expect(
      screen.getByRole('heading', { name: 'Invalid Link' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Invalid invitation token characters')
    ).toBeInTheDocument();
  });

  it('renders invalid invitation state when preview RPC returns error', async () => {
    await renderPageContent({ token: 'valid-token-123' }, [
      { data: null, error: { message: 'Database error' } },
    ]);
    expect(
      screen.getByRole('heading', { name: 'Invalid Invitation' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This invitation link is invalid/)
    ).toBeInTheDocument();
  });

  it('renders invalid invitation state when preview RPC returns empty array', async () => {
    await renderPageContent({ token: 'valid-token-123' }, [
      { data: [], error: null },
    ]);
    expect(
      screen.getByRole('heading', { name: 'Invalid Invitation' })
    ).toBeInTheDocument();
  });

  it('renders invitation preview page (InvitePage) when user is not authenticated', async () => {
    await renderPageContent(
      { token: 'valid-token-123' },
      [{ data: [mockInvite], error: null }],
      { data: { user: null }, error: null }
    );
    expect(
      screen.getByRole('heading', { name: /you're invited!/i })
    ).toBeInTheDocument();
    expect(screen.getByText('OgaBassey Store')).toBeInTheDocument();
    expect(screen.getByText('invitee@example.com')).toBeInTheDocument();
  });

  it('renders transient authentication error when auth getUser returns a non-401 error', async () => {
    await renderPageContent(
      { token: 'valid-token-123' },
      [{ data: [mockInvite], error: null }],
      {
        data: { user: null },
        error: {
          name: 'AuthInternalError',
          message: 'Database unreachable',
          status: 500,
        },
      }
    );
    expect(
      screen.getByRole('heading', { name: 'Authentication Error' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A transient authentication failure occurred/)
    ).toBeInTheDocument();
  });

  it('renders wrong account error when authenticated user email does not match invitation email', async () => {
    await renderPageContent(
      { token: 'valid-token-123' },
      [{ data: [mockInvite], error: null }],
      { data: { user: { email: 'wrong-user@example.com' } }, error: null }
    );
    expect(
      screen.getByRole('heading', { name: 'Wrong Account' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This invitation was sent to invitee@example.com/)
    ).toBeInTheDocument();
  });

  it('renders expired invite error when accept RPC returns invite_expired', async () => {
    await renderPageContent(
      { token: 'valid-token-123' },
      [
        { data: [mockInvite], error: null },
        { error: { message: 'invite_expired' } },
      ],
      { data: { user: { email: 'invitee@example.com' } }, error: null }
    );
    expect(
      screen.getByRole('heading', { name: 'Invitation Expired' })
    ).toBeInTheDocument();
    expect(screen.getByText(/This invitation has expired/)).toBeInTheDocument();
  });

  it('renders already accepted invite error when accept RPC returns invite_used', async () => {
    await renderPageContent(
      { token: 'valid-token-123' },
      [
        { data: [mockInvite], error: null },
        { error: { message: 'invite_used' } },
      ],
      { data: { user: { email: 'invitee@example.com' } }, error: null }
    );
    expect(
      screen.getByRole('heading', { name: 'Already Accepted' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This invitation has already been accepted/)
    ).toBeInTheDocument();
  });

  it('renders generic accept error when accept RPC returns a generic error', async () => {
    await renderPageContent(
      { token: 'valid-token-123' },
      [
        { data: [mockInvite], error: null },
        { error: { message: 'db_failure' } },
      ],
      { data: { user: { email: 'invitee@example.com' } }, error: null }
    );
    expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument();
    expect(
      screen.getByText(/Failed to accept the invitation/)
    ).toBeInTheDocument();
  });

  it('successfully accepts invitation and redirects to dashboard', async () => {
    await renderPageContent(
      { token: 'valid-token-123' },
      [{ data: [mockInvite], error: null }, { error: null }],
      { data: { user: { email: 'invitee@example.com' } }, error: null }
    );
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
