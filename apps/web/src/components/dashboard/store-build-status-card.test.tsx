import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreBuildStatusCard } from './store-build-status-card';

const mockToast = vi.fn();
const { mockFetchWithCsrf } = vi.hoisted(() => ({
  mockFetchWithCsrf: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: mockFetchWithCsrf,
}));

describe('StoreBuildStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Initial readiness uses global fetch; apply mutations use fetchWithCsrf.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        storeBuild: {
          starterStoreReady: true,
          aiStatus: 'ready',
          latestJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
          canApplyAiDraft: false,
          message: 'Your AI storefront is ready to preview and apply.',
        },
      }),
    } as Response);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hides apply controls for view-only staff while keeping preview available', async () => {
    render(<StoreBuildStatusCard />);

    expect(await screen.findByText('AI design ready')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /preview/i })).toHaveAttribute(
      'href',
      '/builder?aiDraftJobId=5c0a0676-bd3f-495e-9f98-589f208c0d79'
    );
    expect(
      screen.queryByRole('button', { name: /apply ai design/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /edit starter store/i })
    ).toHaveAttribute('href', '/builder');
  });

  it('applies a ready AI design successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        storeBuild: {
          starterStoreReady: true,
          aiStatus: 'ready',
          latestJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
          canApplyAiDraft: true,
          message: 'Your AI storefront is ready to preview and apply.',
        },
      }),
    } as Response);
    mockFetchWithCsrf.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        lastUpdated: '2026-04-28T10:10:00.000Z',
      }),
    } as Response);

    render(<StoreBuildStatusCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /apply ai design/i })
    );

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        '/api/ai-jobs/5c0a0676-bd3f-495e-9f98-589f208c0d79/apply',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI design applied' })
    );
  });

  it('renders nothing when the readiness fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { container } = render(<StoreBuildStatusCard />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it.each([
    ['network failure', () => Promise.reject(new Error('offline'))],
    [
      'server failure',
      () =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'server unavailable' }),
        } as Response),
    ],
  ])('shows an apply error toast on %s', async (_, applyResult) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        storeBuild: {
          starterStoreReady: true,
          aiStatus: 'ready',
          latestJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
          canApplyAiDraft: true,
          message: 'Your AI storefront is ready to preview and apply.',
        },
      }),
    } as Response);
    mockFetchWithCsrf.mockImplementationOnce(applyResult);

    render(<StoreBuildStatusCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /apply ai design/i })
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to apply AI design' })
      );
    });
  });

  it('retries stale apply requests only after accessible confirmation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        storeBuild: {
          starterStoreReady: true,
          aiStatus: 'ready',
          latestJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
          canApplyAiDraft: true,
          message: 'Your AI storefront is ready to preview and apply.',
        },
      }),
    } as Response);
    mockFetchWithCsrf
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ code: 'ai_draft_stale' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          lastUpdated: '2026-04-28T10:10:00.000Z',
        }),
      } as Response);

    render(<StoreBuildStatusCard />);

    const applyButton = await screen.findByRole('button', {
      name: /apply ai design/i,
    });
    fireEvent.click(applyButton);

    expect(
      await screen.findByRole('alertdialog', {
        name: /replace your current draft/i,
      })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /replace draft/i }));

    await waitFor(() => {
      expect(mockFetchWithCsrf).toHaveBeenCalledTimes(2);
    });
    expect(mockFetchWithCsrf).toHaveBeenLastCalledWith(
      '/api/ai-jobs/5c0a0676-bd3f-495e-9f98-589f208c0d79/apply',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ force: true }),
      })
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI design applied' })
    );
  });

  it('does not force apply when stale confirmation is cancelled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        storeBuild: {
          starterStoreReady: true,
          aiStatus: 'ready',
          latestJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
          canApplyAiDraft: true,
          message: 'Your AI storefront is ready to preview and apply.',
        },
      }),
    } as Response);
    mockFetchWithCsrf.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ code: 'ai_draft_stale' }),
    } as Response);

    render(<StoreBuildStatusCard />);

    fireEvent.click(
      await screen.findByRole('button', { name: /apply ai design/i })
    );
    expect(
      await screen.findByRole('alertdialog', {
        name: /replace your current draft/i,
      })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /keep current draft/i })
    );

    expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();
  });
});
