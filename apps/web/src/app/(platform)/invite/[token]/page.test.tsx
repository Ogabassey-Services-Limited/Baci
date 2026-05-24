import { render, screen } from '@testing-library/react';
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

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    mockUseParams.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockUseSearchParams.mockReset();
    mockGetUser.mockReset();
    mockFetch.mockReset();
    mockToast.mockReset();

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

    expect(screen.getByText('Validating invitation...')).toBeInTheDocument();
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
});
