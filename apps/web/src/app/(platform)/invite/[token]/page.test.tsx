import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AcceptInvitePage from './page';

const mockUseParams = vi.fn();
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockUseSearchParams = vi.fn();
const mockGetUser = vi.fn();
const mockFetch = vi.fn();
const mockToast = vi.fn();

vi.stubGlobal('fetch', mockFetch);

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
}

function validInvitationResponse() {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      valid: true,
      email: 'staff@example.com',
      role: 'manager',
      merchantName: 'Test Store',
      expiresAt: '2026-12-31T00:00:00.000Z',
    }),
  } as unknown as Response;
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    mockUseParams.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockUseSearchParams.mockReset();
    mockGetUser.mockReset();
    mockFetch.mockReset();
    mockToast.mockReset();
    setUserAgent('Mozilla/5.0');

    mockUseParams.mockReturnValue({ token: 'invite-token' });
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFetch.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally unresolved to keep the loading state visible.
        }) as Promise<Response>
    );
  });

  it('renders the validating state while the invitation request is pending', () => {
    render(<AcceptInvitePage />);

    expect(screen.getByText('Validating invitation…')).toBeInTheDocument();
  });

  it('renders a local fallback while invite params are pending', () => {
    mockUseParams.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally unresolved to keep the suspense fallback visible.
      });
    });

    render(<AcceptInvitePage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading invitation');
  });

  it('updates mobile invite redirects after hydration without changing the server-safe initial render', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
    );
    mockFetch.mockResolvedValue(validInvitationResponse());

    render(<AcceptInvitePage />);

    const createAccountButton = await screen.findByRole('button', {
      name: 'Create Account',
    });

    await waitFor(() => {
      expect(createAccountButton.closest('a')).toHaveAttribute(
        'href',
        expect.stringContaining('client%3Dmobile')
      );
    });
  });
});
