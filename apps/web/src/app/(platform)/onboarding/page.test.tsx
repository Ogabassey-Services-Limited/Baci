import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockCreateClient = vi.fn();
const redirect = vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('next/navigation', () => ({
  redirect: (target: string) => redirect(target),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('./onboarding-page-content', () => ({
  default: () => <div>Onboarding content</div>,
}));

const { default: OnboardingPage } = await import('./page');
const { OnboardingPageContentServer } = await import(
  './onboarding-page-content-server'
);

describe('OnboardingPage', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();
    mockCreateClient.mockReset();
    redirect.mockClear();

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });
    mockCookies.mockResolvedValue(new Map());
  });

  it('renders onboarding content when no authenticated user exists', async () => {
    render(await OnboardingPageContentServer());

    expect(screen.getByText('Onboarding content')).toBeInTheDocument();
  });

  it('redirects to the dashboard when the user already has a merchant', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'merchant-1', business_name: 'Ogabassey' },
      error: null,
    });

    await expect(OnboardingPageContentServer()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard'
    );
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('renders a local fallback while onboarding auth cookies are pending', () => {
    mockCookies.mockReturnValue(
      new Promise(() => {
        // Intentionally never resolves to keep the local fallback visible.
      })
    );

    render(<OnboardingPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading onboarding');
  });

  it('marks the onboarding route as noindex to keep setup pages out of Search Console', async () => {
    const { metadata } = await import('./page');

    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});
