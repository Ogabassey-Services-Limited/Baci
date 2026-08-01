import { isStoreReadiness } from '@baci/shared';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreBuildStatusCard } from './store-build-status-card';
import {
  createMobileReadinessPayload,
  createReadinessPayload,
} from './store-build-status-card.test-helpers';

const { mockFetchWithCsrf } = vi.hoisted(() => ({
  mockFetchWithCsrf: vi.fn(),
}));
const mockToast = vi.fn();
const merchantA = '11111111-1111-4111-8111-111111111111';
const merchantB = '22222222-2222-4222-8222-222222222222';

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

describe('StoreBuildStatusCard readiness loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => createReadinessPayload(),
    } as Response);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders an error state with retry when the readiness fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(<StoreBuildStatusCard merchantId={merchantA} />);

    expect(
      await screen.findByText('Failed to load store build status.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('reloads the readiness payload when retry is clicked after a failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    render(<StoreBuildStatusCard merchantId={merchantA} />);

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    expect(await screen.findByText('AI design ready')).toBeInTheDocument();
    expect(
      screen.queryByText('Failed to load store build status.')
    ).not.toBeInTheDocument();
  });

  it('shows the existing retry state when readiness only contains store build data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ storeBuild: createReadinessPayload().storeBuild }),
    } as Response);

    render(<StoreBuildStatusCard merchantId={merchantA} />);

    expect(
      await screen.findByText('Failed to load store build status.')
    ).toBeInTheDocument();
  });

  it('shows the existing retry state for an otherwise valid mobile readiness payload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const payload = createMobileReadinessPayload();
    expect(isStoreReadiness(payload)).toBe(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    } as Response);

    render(<StoreBuildStatusCard merchantId={merchantA} />);

    expect(
      await screen.findByText('Failed to load store build status.')
    ).toBeInTheDocument();
  });

  it('rejects a valid readiness payload for a different merchant', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...createReadinessPayload(),
        merchantId: merchantB,
      }),
    } as Response);

    render(<StoreBuildStatusCard merchantId={merchantA} />);

    expect(
      await screen.findByText('Failed to load store build status.')
    ).toBeInTheDocument();
    expect(screen.queryByText('AI design ready')).not.toBeInTheDocument();
  });

  it('clears merchant A status before loading scoped readiness for merchant B', async () => {
    let resolveMerchantB: ((response: Response) => void) | undefined;
    const merchantBResponse = new Promise<Response>((resolve) => {
      resolveMerchantB = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (
        url === '/api/merchant/readiness' ||
        url.endsWith(`merchantId=${merchantA}`)
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => createReadinessPayload(true),
        } as Response);
      }

      if (url.endsWith(`merchantId=${merchantB}`)) {
        return merchantBResponse;
      }

      return Promise.reject(new Error(`Unexpected readiness request: ${url}`));
    });

    const { rerender } = render(
      <StoreBuildStatusCard merchantId={merchantA} />
    );

    expect(await screen.findByText('AI design ready')).toBeInTheDocument();

    rerender(<StoreBuildStatusCard merchantId={merchantB} />);

    expect(screen.queryByText('AI design ready')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /apply ai design/i })
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenLastCalledWith(
        `/api/merchant/readiness?merchantId=${merchantB}`,
        { credentials: 'include' }
      );
      expect(screen.queryByText('AI design ready')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /apply ai design/i })
      ).not.toBeInTheDocument();
    });

    await act(async () => {
      resolveMerchantB?.({
        ok: true,
        json: async () => createReadinessPayload(),
      } as Response);
    });
  });

  it('ignores an apply completion after the selected merchant changes', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => createReadinessPayload(true),
    } as Response);
    let resolveApply: ((response: Response) => void) | undefined;
    mockFetchWithCsrf.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveApply = resolve;
      })
    );
    const onApplied = vi.fn();
    const { rerender } = render(
      <StoreBuildStatusCard merchantId={merchantA} onApplied={onApplied} />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /apply ai design/i })
    );
    rerender(
      <StoreBuildStatusCard merchantId={merchantB} onApplied={onApplied} />
    );
    await act(async () => {
      resolveApply?.({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);
    });

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(mockToast).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();

    rerender(
      <StoreBuildStatusCard merchantId={merchantA} onApplied={onApplied} />
    );
    expect(
      await screen.findByRole('button', { name: /apply ai design/i })
    ).not.toBeDisabled();
  });

  it('closes stale-draft confirmation when the selected merchant changes', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => createReadinessPayload(true),
    } as Response);
    mockFetchWithCsrf.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ code: 'ai_draft_stale' }),
    } as Response);
    const { rerender } = render(
      <StoreBuildStatusCard merchantId={merchantA} />
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /apply ai design/i })
    );
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();

    rerender(<StoreBuildStatusCard merchantId={merchantB} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    rerender(<StoreBuildStatusCard merchantId={merchantA} />);
    await screen.findByText('AI design ready');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
