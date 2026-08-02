import { fireEvent, screen, waitFor } from '@testing-library/react';
import { act, type ReactNode, Suspense, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoreBuildStatusCard } from './store-build-status-card';
import { createReadinessPayload } from './store-build-status-card.test-helpers';

const { mockFetchWithCsrf } = vi.hoisted(() => ({
  mockFetchWithCsrf: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: mockFetchWithCsrf }));

describe('StoreBuildStatusCard abandoned renders', () => {
  afterEach(() => vi.restoreAllMocks());

  it('accepts merchant A apply after a merchant B render is abandoned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ...createReadinessPayload(true),
        merchantId: 'merchant-a',
      }),
    } as Response);
    let resolveApply!: (response: Response) => void;
    mockFetchWithCsrf.mockReturnValue(
      new Promise((resolve) => {
        resolveApply = resolve;
      })
    );
    const onApplied = vi.fn();
    const never = new Promise<void>(() => undefined);
    function SuspendAbandonedRender({ suspend }: { suspend: boolean }) {
      if (suspend) throw never;
      return null;
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Suspense fallback={null}>
          <StoreBuildStatusCard merchantId="merchant-a" onApplied={onApplied} />
          <SuspendAbandonedRender suspend={false} />
        </Suspense>
      );
    });
    fireEvent.click(
      await screen.findByRole('button', { name: /apply ai design/i })
    );
    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledOnce());

    act(() => {
      startTransition(() => {
        root.render(
          <Suspense fallback={null}>
            <StoreBuildStatusCard
              merchantId="merchant-b"
              onApplied={onApplied}
            />
            <SuspendAbandonedRender suspend />
          </Suspense>
        );
      });
    });
    await act(async () => {
      resolveApply({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);
    });

    expect(onApplied).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    container.remove();
  });
});
